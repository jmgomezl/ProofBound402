import { describe, expect, it } from "vitest";
import { ChallengeStore } from "../protocol/challenge-store.js";
import { createSettlementAdapterFromEnv } from "./live-settlement.js";

const runLive = process.env.RUN_HEDERA_LIVE_TESTS === "1";

describe.runIf(runLive)("live Hedera x402 settlement", () => {
  it("settles a proof-bound payment and confirms it through Mirror Node", async () => {
    const adapter = createSettlementAdapterFromEnv();
    expect(adapter.mode).toBe("testnet");

    const challenge = new ChallengeStore().issue({
      method: "POST",
      resource: "/reports/market-pulse",
      body: { integrationTest: true },
      amount: adapter.profile.amount,
      asset: adapter.profile.asset,
      payTo: adapter.profile.payTo,
      payer: adapter.profile.payer,
      network: adapter.profile.network,
    });
    const evidence = await adapter.settle(challenge);

    expect(evidence.memo).toBe(challenge.memo);
    expect(evidence.transactionId).toMatch(/^0\.0\.\d+@\d+\.\d+$/);
    expect(evidence.consensusTimestamp).toMatch(/^\d+\.\d+$/);
    expect(evidence.hashscanTransactionUrl).toContain("hashscan.io/testnet/transaction/");
  }, 60_000);
});
