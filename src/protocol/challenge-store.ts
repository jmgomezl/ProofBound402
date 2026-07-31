import { randomBytes, randomUUID } from "node:crypto";
import { buildClaims, hashClaims } from "./canonicalize.js";
import { digestToMemo } from "./memo.js";
import type {
  BindingChallenge,
  RequestIntent,
  VerificationResult,
} from "./types.js";
import { verifyBinding } from "./verifier.js";

export class ChallengeStore {
  readonly #challenges = new Map<string, BindingChallenge>();

  issue(intent: RequestIntent, ttlMs = 120_000, now = Date.now()): BindingChallenge {
    const claims = buildClaims(
      intent,
      randomBytes(18).toString("base64url"),
      now + ttlMs,
    );
    const digest = hashClaims(claims);
    const challenge: BindingChallenge = {
      id: randomUUID(),
      claims,
      digest,
      memo: digestToMemo(digest),
      status: "issued",
    };

    this.#challenges.set(challenge.id, challenge);
    return structuredClone(challenge);
  }

  get(id: string): BindingChallenge | undefined {
    const challenge = this.#challenges.get(id);
    return challenge ? structuredClone(challenge) : undefined;
  }

  redeem(
    id: string,
    memo: string,
    actualIntent: RequestIntent,
    now = Date.now(),
  ): VerificationResult {
    const challenge = this.#challenges.get(id);
    if (!challenge) {
      return {
        ok: false,
        code: "UNKNOWN_CHALLENGE",
        message: "The binding challenge does not exist.",
      };
    }

    const result = verifyBinding(challenge, memo, actualIntent, now);
    if (result.ok) {
      challenge.status = "consumed";
      challenge.consumedAt = now;
    }
    return result;
  }

  clear(): void {
    this.#challenges.clear();
  }
}
