import { randomUUID } from "node:crypto";
import { ChallengeStore } from "../protocol/challenge-store.js";
import type { BindingChallenge, RequestIntent } from "../protocol/types.js";
import {
  DEMO_RESOURCES,
  type ApiResult,
  type DemoEvent,
  type DemoState,
  type ResourceId,
} from "../shared/contracts.js";
import {
  SimulatedSettlementAdapter,
  type SettlementAdapter,
  type SettlementEvidence,
} from "./settlement.js";

const DEMO_PAYER = "0.0.8008";
const DEMO_PAY_TO = "0.0.7007";
const DEMO_AMOUNT = "1000000";
const DEMO_ASSET = "0.0.0";
const DEMO_NETWORK = "hedera:testnet";

function event(
  kind: DemoEvent["kind"],
  title: string,
  detail: string,
  tone: DemoEvent["tone"],
  proof?: Record<string, string>,
): DemoEvent {
  return { id: randomUUID(), at: new Date().toISOString(), kind, title, detail, tone, proof };
}

function asPublicChallenge(challenge: BindingChallenge, resource: ResourceId) {
  return {
    id: challenge.id,
    resource,
    memo: challenge.memo,
    digest: challenge.digest,
    nonce: challenge.claims.nonce,
    expiresAt: challenge.claims.expiresAt,
    status: challenge.status,
  } as const;
}

export class DemoEngine {
  readonly #challenges = new ChallengeStore();
  readonly #settlement: SettlementAdapter;
  #events: DemoEvent[] = [];
  #active?: { challenge: BindingChallenge; resource: ResourceId };
  #evidence?: SettlementEvidence;

  constructor(settlement: SettlementAdapter = new SimulatedSettlementAdapter()) {
    this.#settlement = settlement;
  }

  state(): DemoState {
    const current = this.#active ? this.#challenges.get(this.#active.challenge.id) : undefined;
    return {
      mode: this.#settlement.mode,
      events: structuredClone(this.#events),
      activeChallenge:
        current && this.#active ? asPublicChallenge(current, this.#active.resource) : undefined,
      evidence: this.#evidence ? structuredClone(this.#evidence) : undefined,
    };
  }

  reset(): ApiResult {
    this.#challenges.clear();
    this.#events = [];
    this.#active = undefined;
    this.#evidence = undefined;
    return this.#result(true, "RESET", "Attack lab reset.");
  }

  runUnboundAttack(): ApiResult {
    const paymentId = randomUUID();
    this.#events.push(
      event(
        "payment.created",
        "Payment authorized for Market pulse",
        "The unbound server records only amount, asset, recipient, and payer.",
        "neutral",
        { paymentId, amount: DEMO_AMOUNT, asset: DEMO_ASSET, payTo: DEMO_PAY_TO },
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

  issueBoundChallenge(resource: ResourceId = "basic"): ApiResult {
    const challenge = this.#challenges.issue(this.#intent(resource), 120_000);
    this.#active = { challenge, resource };
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
      this.#intent(target),
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

  async settleBoundRequest(): Promise<ApiResult> {
    if (!this.#active) {
      this.issueBoundChallenge("basic");
    }

    const active = this.#active!;
    const result = this.#challenges.redeem(
      active.challenge.id,
      active.challenge.memo,
      this.#intent(active.resource),
    );
    if (!result.ok) {
      return this.#result(false, result.code, result.message);
    }

    this.#events.push(
      event(
        "request.delivered",
        `${DEMO_RESOURCES[active.resource].label} authorized`,
        "The memo commitment matches the exact inbound request and the nonce is now consumed.",
        "success",
        { digest: active.challenge.digest, nonceState: "CONSUMED" },
      ),
    );

    this.#evidence = await this.#settlement.settle(active.challenge.memo, active.challenge.claims);
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
    return this.#result(true, "DELIVERED", "Bound request settled and delivered.");
  }

  #intent(resource: ResourceId): RequestIntent {
    return {
      method: "POST",
      resource: DEMO_RESOURCES[resource].path,
      body: { format: "json", window: "24h" },
      amount: DEMO_AMOUNT,
      asset: DEMO_ASSET,
      payTo: DEMO_PAY_TO,
      payer: DEMO_PAYER,
      network: DEMO_NETWORK,
    };
  }

  #result(ok: boolean, code: string, message: string): ApiResult {
    return { ok, code, message, state: this.state() };
  }
}
