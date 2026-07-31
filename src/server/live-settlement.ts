import { x402Client } from "@x402/core/client";
import { x402Facilitator } from "@x402/core/facilitator";
import type { PaymentPayload, PaymentRequired } from "@x402/core/types";
import {
  PrivateKey,
  createHederaClient,
  createHederaPreflightTransfer,
  createHederaSignAndSubmitTransaction,
  createHederaVerifyPayerSignature,
  type FacilitatorHederaSigner,
} from "@x402/hedera";
import { ExactHederaScheme as ExactHederaClientScheme } from "@x402/hedera/exact/client";
import { ExactHederaScheme as ExactHederaFacilitatorScheme } from "@x402/hedera/exact/facilitator";
import type { BindingChallenge } from "../protocol/types.js";
import {
  assertTransactionBinding,
  createProofBoundHederaSigner,
} from "../protocol/hedera-x402.js";
import { toMirrorTransactionId, waitForMirrorSettlement } from "./mirror-node.js";
import {
  SimulatedSettlementAdapter,
  buildPaymentRequired,
  type PaymentProfile,
  type SettlementAdapter,
  type SettlementEvidence,
} from "./settlement.js";

interface LiveSettlementConfig {
  payerAccountId: string;
  payerPrivateKey?: string;
  facilitatorAccountId: string;
  facilitatorPrivateKey: string;
  payToAccountId: string;
  amount: string;
  asset: string;
  mirrorNodeUrl?: string;
  challengeTtlSeconds?: number;
  resourceBaseUrl?: string;
}

function parseEcdsaPrivateKey(value: string): PrivateKey {
  const normalized = value.startsWith("0x") ? value : `0x${value}`;
  return PrivateKey.fromStringECDSA(normalized);
}

export class LiveHederaSettlementAdapter implements SettlementAdapter {
  readonly mode = "testnet" as const;
  readonly profile: PaymentProfile;
  readonly #payerKey?: PrivateKey;
  readonly #facilitatorKey: PrivateKey;
  readonly #mirrorNodeUrl: string;

  constructor(config: LiveSettlementConfig) {
    if (config.payerAccountId === config.facilitatorAccountId) {
      throw new Error("Payer and facilitator accounts must be distinct");
    }
    if (config.payToAccountId === config.facilitatorAccountId) {
      throw new Error("Recipient and facilitator accounts must be distinct for exact Mirror Node evidence");
    }
    if (config.payToAccountId === config.payerAccountId) {
      throw new Error("Recipient and payer accounts must be distinct");
    }
    if (BigInt(config.amount) <= 0n) {
      throw new Error("PROOFBOUND_AMOUNT must be greater than zero");
    }
    const challengeTtlSeconds = config.challengeTtlSeconds ?? 120;
    if (!Number.isSafeInteger(challengeTtlSeconds) || challengeTtlSeconds <= 0) {
      throw new Error("PROOFBOUND_CHALLENGE_TTL_SECONDS must be a positive integer");
    }

    this.profile = {
      payer: config.payerAccountId,
      payTo: config.payToAccountId,
      feePayer: config.facilitatorAccountId,
      amount: config.amount,
      asset: config.asset,
      network: "hedera:testnet",
      challengeTtlSeconds,
      resourceBaseUrl: config.resourceBaseUrl ?? "http://localhost:4402",
    };
    this.#payerKey = config.payerPrivateKey
      ? parseEcdsaPrivateKey(config.payerPrivateKey)
      : undefined;
    this.#facilitatorKey = parseEcdsaPrivateKey(config.facilitatorPrivateKey);
    this.#mirrorNodeUrl = config.mirrorNodeUrl ?? "https://testnet.mirrornode.hedera.com";
  }

  paymentRequired(challenge: BindingChallenge): PaymentRequired {
    return buildPaymentRequired(challenge, this.profile);
  }

  async settle(
    challenge: BindingChallenge,
    suppliedPaymentPayload?: PaymentPayload,
  ): Promise<SettlementEvidence> {
    const paymentRequired = this.paymentRequired(challenge);
    const requirements = paymentRequired.accepts[0];
    let paymentPayload = suppliedPaymentPayload;
    if (!paymentPayload) {
      if (!this.#payerKey) {
        throw new Error(
          "Self-driven settlement requires HEDERA_PAYER_PRIVATE_KEY; external clients may supply PAYMENT-SIGNATURE instead",
        );
      }
      const payerSigner = createProofBoundHederaSigner(
        this.profile.payer,
        this.#payerKey,
        { network: this.profile.network },
      );
      const client = new x402Client().register(
        this.profile.network,
        new ExactHederaClientScheme(payerSigner),
      );
      paymentPayload = await client.createPaymentPayload(paymentRequired);
    }
    const encodedTransaction = paymentPayload.payload.transaction;
    if (typeof encodedTransaction !== "string") {
      throw new Error("x402 client did not produce a Hedera transaction payload");
    }

    assertTransactionBinding(encodedTransaction, challenge.digest);

    const facilitatorSigner: FacilitatorHederaSigner = {
      getAddresses: () => [this.profile.feePayer],
      signAndSubmitTransaction: createHederaSignAndSubmitTransaction(
        (network) => createHederaClient(network),
        this.#facilitatorKey,
      ),
      verifyPayerSignature: createHederaVerifyPayerSignature({
        mirrorNodeUrl: this.#mirrorNodeUrl,
      }),
      preflightTransfer: createHederaPreflightTransfer({
        mirrorNodeUrl: this.#mirrorNodeUrl,
      }),
    };
    const facilitator = new x402Facilitator().register(
      this.profile.network,
      new ExactHederaFacilitatorScheme(facilitatorSigner),
    );

    const verification = await facilitator.verify(paymentPayload, requirements);
    if (!verification.isValid) {
      throw new Error(
        `x402 facilitator rejected payment: ${verification.invalidReason ?? "unknown_reason"}`,
      );
    }

    const settlement = await facilitator.settle(paymentPayload, requirements);
    if (!settlement.success) {
      throw new Error(
        `x402 settlement failed: ${settlement.errorReason ?? settlement.errorMessage ?? "unknown_reason"}`,
      );
    }

    const mirrored = await waitForMirrorSettlement({
      transactionId: settlement.transaction,
      memo: challenge.memo,
      payer: this.profile.payer,
      payTo: this.profile.payTo,
      asset: this.profile.asset,
      amount: this.profile.amount,
    }, { baseUrl: this.#mirrorNodeUrl });

    return {
      transactionId: settlement.transaction,
      consensusTimestamp: mirrored.consensusTimestamp,
      memo: mirrored.memo,
      hashscanTransactionUrl: `https://hashscan.io/testnet/transaction/${toMirrorTransactionId(settlement.transaction)}`,
    };
  }
}

const LIVE_REQUIRED_ENV_KEYS = [
  "HEDERA_PAYER_ACCOUNT_ID",
  "HEDERA_FACILITATOR_ACCOUNT_ID",
  "HEDERA_FACILITATOR_PRIVATE_KEY",
  "PROOFBOUND_PAY_TO",
] as const;

const LIVE_ENV_SIGNAL_KEYS = [
  ...LIVE_REQUIRED_ENV_KEYS,
  "HEDERA_PAYER_PRIVATE_KEY",
] as const;

export function createSettlementAdapterFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): SettlementAdapter {
  const configured = LIVE_ENV_SIGNAL_KEYS.filter((key) => Boolean(env[key]));
  if (configured.length === 0) {
    return new SimulatedSettlementAdapter();
  }
  const missing = LIVE_REQUIRED_ENV_KEYS.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Incomplete Hedera live configuration; missing ${missing.join(", ")}`);
  }

  return new LiveHederaSettlementAdapter({
    payerAccountId: env.HEDERA_PAYER_ACCOUNT_ID!,
    payerPrivateKey: env.HEDERA_PAYER_PRIVATE_KEY,
    facilitatorAccountId: env.HEDERA_FACILITATOR_ACCOUNT_ID!,
    facilitatorPrivateKey: env.HEDERA_FACILITATOR_PRIVATE_KEY!,
    payToAccountId: env.PROOFBOUND_PAY_TO!,
    amount: env.PROOFBOUND_AMOUNT ?? "1000000",
    asset: env.PROOFBOUND_ASSET ?? "0.0.0",
    mirrorNodeUrl: env.HEDERA_MIRROR_NODE_URL,
    challengeTtlSeconds: Number.parseInt(
      env.PROOFBOUND_CHALLENGE_TTL_SECONDS ?? "120",
      10,
    ),
    resourceBaseUrl: env.PROOFBOUND_RESOURCE_BASE_URL,
  });
}
