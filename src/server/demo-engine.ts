import { randomUUID } from "node:crypto";
import type { PaymentPayload, PaymentRequired, SettleResponse } from "@x402/core/types";
import { ChallengeStore } from "../protocol/challenge-store.js";
import type { BindingChallenge, RequestIntent } from "../protocol/types.js";
import {
  DEMO_RESOURCES,
  type ApiResult,
  type DeliveredReport,
  type DemoEvent,
  type DemoState,
  type ResourceId,
} from "../shared/contracts.js";
import {
  SimulatedSettlementAdapter,
  type SettlementAdapter,
  type SettlementEvidence,
} from "./settlement.js";

function event(
  kind: DemoEvent["kind"],
  title: string,
  detail: string,
  tone: DemoEvent["tone"],
  proof?: Record<string, string>,
): DemoEvent {
  return { id: randomUUID(), at: new Date().toISOString(), kind, title, detail, tone, proof };
}

function asPublicChallenge(
  challenge: BindingChallenge,
  resource: ResourceId,
  settlement: SettlementAdapter,
) {
  const paymentRequired = settlement.paymentRequired(challenge);
  const requirement = paymentRequired.accepts[0];
  return {
    id: challenge.id,
    resource,
    memo: challenge.memo,
    digest: challenge.digest,
    nonce: challenge.claims.nonce,
    expiresAt: challenge.claims.expiresAt,
    status: challenge.status,
    paymentRequired: {
      x402Version: paymentRequired.x402Version,
      resource: paymentRequired.resource.url,
      scheme: requirement.scheme,
      network: requirement.network,
      amount: requirement.amount,
      asset: requirement.asset,
      payTo: requirement.payTo,
      feePayer: String(requirement.extra?.feePayer ?? ""),
    },
  } as const;
}

export class DemoEngine {
  readonly #challenges = new ChallengeStore();
  readonly #settlement: SettlementAdapter;
  #events: DemoEvent[] = [];
  #active?: { challenge: BindingChallenge; resource: ResourceId; body: unknown };
  #deliveredReport?: DeliveredReport;
  #evidence?: SettlementEvidence;

  constructor(settlement: SettlementAdapter = new SimulatedSettlementAdapter()) {
    this.#settlement = settlement;
  }

  state(): DemoState {
    const current = this.#active ? this.#challenges.get(this.#active.challenge.id) : undefined;
    return {
      mode: this.#settlement.mode,
      events: structuredClone(this.#events),
      deliveredReport: this.#deliveredReport
        ? structuredClone(this.#deliveredReport)
        : undefined,
      activeChallenge:
        current && this.#active
          ? asPublicChallenge(current, this.#active.resource, this.#settlement)
          : undefined,
      evidence: this.#evidence ? structuredClone(this.#evidence) : undefined,
    };
  }

  paymentRequired(): PaymentRequired | undefined {
    const current = this.#active ? this.#challenges.get(this.#active.challenge.id) : undefined;
    return current ? this.#settlement.paymentRequired(current) : undefined;
  }

  paymentResponse(): SettleResponse | undefined {
    if (!this.#evidence || !this.#active) {
      return undefined;
    }
    return {
      success: true,
      payer: this.#settlement.profile.payer,
      transaction: this.#evidence.transactionId,
      network: this.#settlement.profile.network,
      amount: this.#settlement.profile.amount,
    };
  }

  reset(): ApiResult {
    this.#challenges.clear();
    this.#events = [];
    this.#active = undefined;
    this.#deliveredReport = undefined;
    this.#evidence = undefined;
    return this.#result(true, "RESET", "Attack lab reset.");
  }

  runUnboundAttack(): ApiResult {
    const paymentId = randomUUID();
    const { amount, asset, payTo } = this.#settlement.profile;
    this.#events.push(
      event(
        "payment.created",
        "Payment authorized for Market pulse",
        "The unbound server records only amount, asset, recipient, and payer.",
        "neutral",
        { paymentId, amount, asset, payTo },
      ),
      event(
        "attack.accepted",
        "Transplant accepted by Alpha dossier",
        "Both resources share the same payment terms, so the unbound check cannot distinguish them.",
        "danger",
        { paymentId, requestedResource: DEMO_RESOURCES.premium.path, decision: "DELIVER" },
      ),
    );
    return this.#result(
      true,
      "UNBOUND_ATTACK_ACCEPTED",
      "The vulnerable integration delivered the wrong resource.",
    );
  }

  issueBoundChallenge(
    resource: ResourceId = "basic",
    body: unknown = { format: "json", window: "24h" },
  ): ApiResult {
    const challenge = this.#challenges.issue(
      this.#intent(resource, body),
      this.#settlement.profile.challengeTtlSeconds * 1_000,
    );
    this.#active = { challenge, resource, body };
    this.#deliveredReport = undefined;
    this.#evidence = undefined;
    this.#events.push(
      event(
        "challenge.issued",
        `Binding issued for ${DEMO_RESOURCES[resource].label}`,
        "Method, resource, body hash, payment terms, payer, nonce, network, and expiry are committed.",
        "neutral",
        { digest: challenge.digest, memo: challenge.memo, nonce: challenge.claims.nonce },
      ),
    );
    return this.#result(true, "CHALLENGE_ISSUED", "One-time request binding created.");
  }

  runBoundAttack(): ApiResult {
    if (!this.#active) {
      this.issueBoundChallenge("basic");
    }

    const active = this.#active!;
    const target: ResourceId = active.resource === "basic" ? "premium" : "basic";
    const result = this.#challenges.redeem(
      active.challenge.id,
      active.challenge.memo,
      this.#intent(target, active.body),
    );

    this.#events.push(
      event(
        "attack.blocked",
        `Transplant blocked at ${DEMO_RESOURCES[target].label}`,
        result.message,
        "success",
        {
          decision: "DENY",
          invariant: result.code,
          signedResource: DEMO_RESOURCES[active.resource].path,
          requestedResource: DEMO_RESOURCES[target].path,
        },
      ),
    );
    return this.#result(!result.ok, result.code, result.message);
  }

  async settleBoundRequest(
    paymentPayload?: PaymentPayload,
    actualRequest?: { resource: ResourceId; body: unknown },
  ): Promise<ApiResult> {
    if (!this.#active) {
      this.issueBoundChallenge("basic");
    }

    const active = this.#active!;
    const actualResource = actualRequest?.resource ?? active.resource;
    const actualBody = actualRequest?.body ?? active.body;
    const result = this.#challenges.reserve(
      active.challenge.id,
      active.challenge.memo,
      this.#intent(actualResource, actualBody),
    );
    if (!result.ok) {
      return this.#result(false, result.code, result.message);
    }

    try {
      this.#evidence = await this.#settlement.settle(active.challenge, paymentPayload);
    } catch (error) {
      this.#challenges.release(active.challenge.id);
      throw error;
    }
    if (!this.#challenges.commit(active.challenge.id)) {
      throw new Error("Binding reservation was lost before delivery");
    }
    this.#deliveredReport = {
      resource: active.resource,
      content: [...DEMO_RESOURCES[active.resource].content],
    };

    this.#events.push(
      event(
        "settlement.confirmed",
        `${this.#settlement.mode === "testnet" ? "Hedera" : "Simulated"} settlement confirmed`,
        "The payment evidence carries the same request-binding memo.",
        "success",
        {
          transactionId: this.#evidence.transactionId,
          consensusTimestamp: this.#evidence.consensusTimestamp,
          memo: this.#evidence.memo,
        },
      ),
      event(
        "request.delivered",
        `${DEMO_RESOURCES[active.resource].label} authorized`,
        "The signed memo matches the inbound request, settlement is public, and the nonce is consumed.",
        "success",
        {
          digest: active.challenge.digest,
          nonceState: "CONSUMED",
        },
      ),
    );
    if (this.#evidence.hcsTopicId && this.#evidence.hcsSequenceNumber) {
      this.#events.push(
        event(
          "receipt.published",
          `${this.#settlement.mode === "testnet" ? "HCS" : "Simulated HCS"} receipt published`,
          "The public receipt links request authorization, settlement, and delivery without exposing the body.",
          "success",
          {
            topicId: this.#evidence.hcsTopicId,
            sequenceNumber: this.#evidence.hcsSequenceNumber,
          },
        ),
      );
    }
    return this.#result(true, "DELIVERED", "Bound request settled and delivered.");
  }

  #intent(resource: ResourceId, body: unknown = { format: "json", window: "24h" }): RequestIntent {
    return {
      method: "POST",
      resource: DEMO_RESOURCES[resource].path,
      body,
      amount: this.#settlement.profile.amount,
      asset: this.#settlement.profile.asset,
      payTo: this.#settlement.profile.payTo,
      payer: this.#settlement.profile.payer,
      network: this.#settlement.profile.network,
    };
  }

  #result(ok: boolean, code: string, message: string): ApiResult {
    return { ok, code, message, state: this.state() };
  }
}
