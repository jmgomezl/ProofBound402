import { describe, expect, it } from "vitest";
import { ChallengeStore } from "./challenge-store.js";
import { buildClaims, hashBody, hashClaims, normalizeResource, stableJson } from "./canonicalize.js";
import { digestToMemo, memoToDigest } from "./memo.js";
import type { RequestIntent } from "./types.js";

const intent: RequestIntent = {
  method: "post",
  resource: "/reports/market-pulse?currency=usd&region=latam",
  body: { window: 24, filters: { liquid: true, tags: ["hbar", "usdc"] } },
  amount: "1000000",
  asset: "0.0.0",
  payTo: "0.0.7007",
  payer: "0.0.8008",
  network: "hedera:testnet",
};

describe("canonicalization", () => {
  it("sorts object keys and query parameters deterministically", () => {
    expect(stableJson({ z: 1, a: { y: 2, b: 3 } })).toBe('{"a":{"b":3,"y":2},"z":1}');
    expect(normalizeResource("/reports/market-pulse?region=latam&currency=usd#ignored")).toBe(
      "/reports/market-pulse?currency=usd&region=latam",
    );
  });

  it("hashes equivalent JSON bodies identically", () => {
    expect(hashBody({ b: 2, a: 1 })).toBe(hashBody({ a: 1, b: 2 }));
  });
});

describe("Hedera memo commitment", () => {
  it("round-trips a full SHA-256 digest within the memo budget", () => {
    const claims = buildClaims(intent, "nonce", 1_800_000_000_000);
    const digest = hashClaims(claims);
    const memo = digestToMemo(digest);

    expect(memoToDigest(memo)).toBe(digest);
    expect(Buffer.byteLength(memo, "utf8")).toBeLessThanOrEqual(100);
  });

  it("rejects malformed memos", () => {
    expect(memoToDigest("hello")).toBeNull();
    expect(memoToDigest("pb402:v1:short")).toBeNull();
  });
});

describe("one-time request binding", () => {
  it("accepts the exact request and blocks replay", () => {
    const store = new ChallengeStore();
    const challenge = store.issue(intent, 120_000, 1_700_000_000_000);

    expect(store.redeem(challenge.id, challenge.memo, intent, 1_700_000_001_000).code).toBe("BOUND");
    expect(store.redeem(challenge.id, challenge.memo, intent, 1_700_000_002_000).code).toBe("REPLAY");
  });

  it("reserves atomically and can release a failed settlement", () => {
    const store = new ChallengeStore();
    const challenge = store.issue(intent, 120_000, 1_700_000_000_000);

    expect(store.reserve(challenge.id, challenge.memo, intent, 1_700_000_001_000).code).toBe("BOUND");
    expect(store.get(challenge.id)?.status).toBe("reserved");
    expect(store.reserve(challenge.id, challenge.memo, intent, 1_700_000_001_100).code).toBe("REPLAY");
    expect(store.release(challenge.id)).toBe(true);
    expect(store.get(challenge.id)?.status).toBe("issued");
    expect(store.reserve(challenge.id, challenge.memo, intent, 1_700_000_001_200).code).toBe("BOUND");
    expect(store.commit(challenge.id, 1_700_000_001_300)).toBe(true);
    expect(store.get(challenge.id)?.status).toBe("consumed");
  });

  it("blocks cross-resource payment transplant", () => {
    const store = new ChallengeStore();
    const challenge = store.issue(intent, 120_000, 1_700_000_000_000);
    const transplanted = { ...intent, resource: "/reports/alpha-dossier?currency=usd&region=latam" };

    const result = store.redeem(challenge.id, challenge.memo, transplanted, 1_700_000_001_000);
    expect(result).toMatchObject({ ok: false, code: "RESOURCE_MISMATCH" });
  });

  it("blocks body tampering without leaking the body", () => {
    const store = new ChallengeStore();
    const challenge = store.issue(intent, 120_000, 1_700_000_000_000);
    const tampered = { ...intent, body: { window: 720 } };

    expect(store.redeem(challenge.id, challenge.memo, tampered, 1_700_000_001_000).code).toBe(
      "BODY_MISMATCH",
    );
  });

  it("fails closed after expiry", () => {
    const store = new ChallengeStore();
    const challenge = store.issue(intent, 500, 1_700_000_000_000);

    expect(store.redeem(challenge.id, challenge.memo, intent, 1_700_000_000_501).code).toBe(
      "EXPIRED",
    );
  });
});
