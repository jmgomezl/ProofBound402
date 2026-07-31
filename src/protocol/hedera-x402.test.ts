import type { PaymentRequirements } from "@x402/core/types";
import { PrivateKey } from "@x402/hedera";
import { describe, expect, it } from "vitest";
import { ChallengeStore } from "./challenge-store.js";
import {
  PROOFBOUND_EXTRA_KEY,
  assertTransactionBinding,
  createProofBoundHederaSigner,
  extractProofBoundMemo,
} from "./hedera-x402.js";

describe("x402 Hedera signer", () => {
  it("places the request digest in the payer-signed TransferTransaction memo", async () => {
    const store = new ChallengeStore();
    const challenge = store.issue({
      method: "GET",
      resource: "/reports/market-pulse",
      amount: "1000",
      asset: "0.0.0",
      payTo: "0.0.7007",
      payer: "0.0.8008",
      network: "hedera:testnet",
    });
    const requirements: PaymentRequirements = {
      scheme: "exact",
      network: "hedera:testnet",
      amount: "1000",
      asset: "0.0.0",
      payTo: "0.0.7007",
      maxTimeoutSeconds: 120,
      extra: {
        feePayer: "0.0.9009",
        [PROOFBOUND_EXTRA_KEY]: { memo: challenge.memo, challengeId: challenge.id },
      },
    };
    const signer = createProofBoundHederaSigner("0.0.8008", PrivateKey.generateECDSA());

    const encoded = await signer.createPartiallySignedTransferTransaction(requirements);

    expect(extractProofBoundMemo(encoded)).toBe(challenge.memo);
    expect(assertTransactionBinding(encoded, challenge.digest)).toBe(challenge.memo);
    expect(() => assertTransactionBinding(encoded, "0".repeat(64))).toThrow(/does not match/);
  });
});
