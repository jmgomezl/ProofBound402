import { PrivateKey } from "@x402/hedera";
import { describe, expect, it } from "vitest";
import { ChallengeStore } from "../protocol/challenge-store.js";
import {
  LiveHederaSettlementAdapter,
  createSettlementAdapterFromEnv,
} from "./live-settlement.js";

describe("live settlement configuration", () => {
  it("defaults to explicit simulation when no credentials exist", () => {
    expect(createSettlementAdapterFromEnv({}).mode).toBe("simulated");
  });

  it("rejects partial credentials instead of silently simulating", () => {
    expect(() => createSettlementAdapterFromEnv({
      HEDERA_PAYER_ACCOUNT_ID: "0.0.8008",
    })).toThrow(/Incomplete Hedera live configuration/);
  });

  it("emits proof-bound x402 requirements from live account configuration", () => {
    const adapter = new LiveHederaSettlementAdapter({
      payerAccountId: "0.0.8008",
      payerPrivateKey: PrivateKey.generateECDSA().toString(),
      facilitatorAccountId: "0.0.9009",
      facilitatorPrivateKey: PrivateKey.generateECDSA().toString(),
      payToAccountId: "0.0.7007",
      amount: "1000",
      asset: "0.0.0",
      challengeTtlSeconds: 90,
      resourceBaseUrl: "https://api.example.test",
    });
    const challenge = new ChallengeStore().issue({
      method: "POST",
      resource: "/reports/market-pulse",
      body: { query: "hbar" },
      amount: adapter.profile.amount,
      asset: adapter.profile.asset,
      payTo: adapter.profile.payTo,
      payer: adapter.profile.payer,
      network: adapter.profile.network,
    });

    const paymentRequired = adapter.paymentRequired(challenge);
    expect(paymentRequired).toMatchObject({
      x402Version: 2,
      resource: { url: "https://api.example.test/reports/market-pulse" },
      accepts: [{
        scheme: "exact",
        network: "hedera:testnet",
        amount: "1000",
        payTo: "0.0.7007",
        maxTimeoutSeconds: 90,
        extra: {
          feePayer: "0.0.9009",
          proofBound402: {
            challengeId: challenge.id,
            memo: challenge.memo,
            digest: challenge.digest,
          },
        },
      }],
    });
  });

  it("keeps the payer key optional for externally signed HTTP payments", () => {
    const adapter = createSettlementAdapterFromEnv({
      HEDERA_PAYER_ACCOUNT_ID: "0.0.8008",
      HEDERA_FACILITATOR_ACCOUNT_ID: "0.0.9009",
      HEDERA_FACILITATOR_PRIVATE_KEY: PrivateKey.generateECDSA().toString(),
      PROOFBOUND_PAY_TO: "0.0.7007",
    });

    expect(adapter.mode).toBe("testnet");
    expect(adapter.profile.payer).toBe("0.0.8008");
  });
});
