import { describe, expect, it, vi } from "vitest";
import { toMirrorTransactionId, waitForMirrorSettlement } from "./mirror-node.js";

const expected = {
  transactionId: "0.0.9009@1700000000.000000001",
  memo: `pb402:v1:${"A".repeat(43)}`,
  payer: "0.0.8008",
  payTo: "0.0.7007",
  asset: "0.0.0",
  amount: "1000",
};

function mirrorResponse(overrides: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({
    transactions: [{
      transaction_id: expected.transactionId,
      consensus_timestamp: "1700000001.000000002",
      result: "SUCCESS",
      memo_base64: Buffer.from(expected.memo).toString("base64"),
      transfers: [
        { account: expected.payer, amount: -1000 },
        { account: expected.payTo, amount: 1000 },
      ],
      ...overrides,
    }],
  }), { status: 200, headers: { "content-type": "application/json" } });
}

describe("Mirror Node settlement verification", () => {
  it("converts an SDK transaction ID to the Mirror Node path format", () => {
    expect(toMirrorTransactionId(expected.transactionId)).toBe(
      "0.0.9009-1700000000-000000001",
    );
  });

  it("waits for indexing then confirms result, memo, and transfers", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ transactions: [] }), { status: 200 }))
      .mockResolvedValueOnce(mirrorResponse());

    const result = await waitForMirrorSettlement(expected, {
      fetchImpl,
      maxAttempts: 2,
      intervalMs: 0,
    });

    expect(result).toMatchObject({
      transactionId: expected.transactionId,
      consensusTimestamp: "1700000001.000000002",
      memo: expected.memo,
      result: "SUCCESS",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://testnet.mirrornode.hedera.com/api/v1/transactions/0.0.9009-1700000000-000000001",
      { headers: { accept: "application/json" } },
    );
  });

  it("fails closed when the public memo differs", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      mirrorResponse({ memo_base64: Buffer.from("different").toString("base64") }),
    );

    await expect(waitForMirrorSettlement(expected, { fetchImpl, maxAttempts: 1 })).rejects.toThrow(
      /memo does not match/,
    );
  });

  it("fails closed when transfer evidence differs", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      mirrorResponse({ transfers: [{ account: expected.payer, amount: -999 }, { account: expected.payTo, amount: 999 }] }),
    );

    await expect(waitForMirrorSettlement(expected, { fetchImpl, maxAttempts: 1 })).rejects.toThrow(
      /payer debit does not match/,
    );
  });

  it("fails closed rather than comparing an imprecise numeric transfer", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      mirrorResponse({ transfers: [{ account: expected.payer, amount: Number.MAX_SAFE_INTEGER + 1 }] }),
    );

    await expect(waitForMirrorSettlement(expected, { fetchImpl, maxAttempts: 1 })).rejects.toThrow(
      /unsafe numeric transfer amount/,
    );
  });
});
