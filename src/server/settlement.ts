import { randomInt } from "node:crypto";
import type { PaymentPayload, PaymentRequired, PaymentRequirements } from "@x402/core/types";
import type { BindingChallenge } from "../protocol/types.js";

export interface PaymentProfile {
  payer: string;
  payTo: string;
  feePayer: string;
  amount: string;
  asset: string;
  network: "hedera:testnet";
  challengeTtlSeconds: number;
  resourceBaseUrl: string;
}

export interface SettlementEvidence {
  transactionId: string;
  consensusTimestamp: string;
  memo: string;
  hcsTopicId?: string;
  hcsSequenceNumber?: string;
  hashscanTransactionUrl?: string;
  hashscanTopicUrl?: string;
}

export interface SettlementAdapter {
  readonly mode: "simulated" | "testnet";
  readonly profile: PaymentProfile;
  paymentRequired(challenge: BindingChallenge): PaymentRequired;
  settle(challenge: BindingChallenge, paymentPayload?: PaymentPayload): Promise<SettlementEvidence>;
}

export function buildPaymentRequirements(
  challenge: BindingChallenge,
  profile: PaymentProfile,
): PaymentRequirements {
  return {
    scheme: "exact",
    network: profile.network,
    amount: profile.amount,
    asset: profile.asset,
    payTo: profile.payTo,
    maxTimeoutSeconds: profile.challengeTtlSeconds,
    extra: {
      feePayer: profile.feePayer,
      proofBound402: {
        version: "1",
        challengeId: challenge.id,
        memo: challenge.memo,
        digest: challenge.digest,
        nonce: challenge.claims.nonce,
        expiresAt: challenge.claims.expiresAt,
      },
    },
  };
}

export function buildPaymentRequired(
  challenge: BindingChallenge,
  profile: PaymentProfile,
): PaymentRequired {
  return {
    x402Version: 2,
    resource: {
      url: new URL(challenge.claims.resource, profile.resourceBaseUrl).toString(),
      description: "ProofBound402 protected resource",
      mimeType: "application/json",
      serviceName: "ProofBound402",
    },
    accepts: [buildPaymentRequirements(challenge, profile)],
    extensions: {
      proofBound402: {
        version: "1",
        algorithm: "sha256",
        commitment: "hedera-transaction-memo",
      },
    },
  };
}

export class SimulatedSettlementAdapter implements SettlementAdapter {
  readonly mode = "simulated" as const;
  readonly profile: PaymentProfile = {
    payer: "0.0.8008",
    payTo: "0.0.7007",
    feePayer: "0.0.9009",
    amount: "1000000",
    asset: "0.0.0",
    network: "hedera:testnet",
    challengeTtlSeconds: 120,
    resourceBaseUrl: "http://localhost:4402",
  };

  paymentRequired(challenge: BindingChallenge): PaymentRequired {
    return buildPaymentRequired(challenge, this.profile);
  }

  async settle(challenge: BindingChallenge, _paymentPayload?: PaymentPayload): Promise<SettlementEvidence> {
    const seconds = Math.floor(Date.now() / 1_000);
    const nanos = randomInt(100_000_000, 999_999_999);

    return {
      transactionId: `0.0.402402@${seconds}.${nanos}`,
      consensusTimestamp: `${seconds}.${nanos}`,
      memo: challenge.memo,
    };
  }
}
