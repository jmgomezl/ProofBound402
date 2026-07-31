import { buildClaims, hashClaims } from "./canonicalize.js";
import { memoToDigest } from "./memo.js";
import type {
  BindingChallenge,
  BindingClaims,
  RequestIntent,
  VerificationCode,
  VerificationResult,
} from "./types.js";

function failure(code: VerificationCode, message: string): VerificationResult {
  return { ok: false, code, message };
}

function compareClaims(expected: BindingClaims, actual: BindingClaims): VerificationResult | null {
  if (expected.method !== actual.method) {
    return failure("METHOD_MISMATCH", "The payment was signed for a different HTTP method.");
  }
  if (expected.resource !== actual.resource) {
    return failure("RESOURCE_MISMATCH", "The payment was signed for a different resource.");
  }
  if (expected.bodySha256 !== actual.bodySha256) {
    return failure("BODY_MISMATCH", "The request body changed after the payment was signed.");
  }
  if (
    expected.amount !== actual.amount ||
    expected.asset !== actual.asset ||
    expected.payTo !== actual.payTo
  ) {
    return failure("PAYMENT_TERMS_MISMATCH", "The amount, asset, or recipient does not match.");
  }
  if (expected.payer !== actual.payer) {
    return failure("PAYER_MISMATCH", "The proof belongs to a different payer.");
  }
  if (expected.network !== actual.network) {
    return failure("NETWORK_MISMATCH", "The proof was created for a different network.");
  }
  return null;
}

export function verifyBinding(
  challenge: BindingChallenge,
  memo: string,
  actualIntent: RequestIntent,
  now = Date.now(),
): VerificationResult {
  if (challenge.status !== "issued") {
    return failure("REPLAY", "This one-time binding has already been redeemed.");
  }
  if (now > challenge.claims.expiresAt) {
    return failure("EXPIRED", "The binding challenge has expired.");
  }

  const memoDigest = memoToDigest(memo);
  if (!memoDigest) {
    return failure("MALFORMED_MEMO", "The Hedera transaction memo is not a ProofBound402 memo.");
  }
  if (memoDigest !== challenge.digest) {
    return {
      ...failure("MEMO_MISMATCH", "The transaction memo does not commit to this challenge."),
      expectedDigest: challenge.digest,
      actualDigest: memoDigest,
    };
  }

  const actualClaims = buildClaims(
    actualIntent,
    challenge.claims.nonce,
    challenge.claims.expiresAt,
  );
  const mismatch = compareClaims(challenge.claims, actualClaims);
  if (mismatch) {
    return mismatch;
  }

  const actualDigest = hashClaims(actualClaims);
  if (actualDigest !== memoDigest) {
    return {
      ...failure("MEMO_MISMATCH", "The actual request does not match the memo commitment."),
      expectedDigest: memoDigest,
      actualDigest,
    };
  }

  return {
    ok: true,
    code: "BOUND",
    message: "Payment is bound to this exact request.",
    expectedDigest: memoDigest,
    actualDigest,
  };
}
