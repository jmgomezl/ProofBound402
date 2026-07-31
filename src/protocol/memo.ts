import { MEMO_PREFIX } from "./types.js";

const SHA256_HEX = /^[a-f0-9]{64}$/;
const SHA256_BASE64URL = /^[A-Za-z0-9_-]{43}$/;

export function digestToMemo(digest: string): string {
  if (!SHA256_HEX.test(digest)) {
    throw new TypeError("Binding digest must be a lowercase SHA-256 hex value");
  }

  return `${MEMO_PREFIX}${Buffer.from(digest, "hex").toString("base64url")}`;
}

export function memoToDigest(memo: string): string | null {
  if (!memo.startsWith(MEMO_PREFIX)) {
    return null;
  }

  const encoded = memo.slice(MEMO_PREFIX.length);
  if (!SHA256_BASE64URL.test(encoded)) {
    return null;
  }

  const digest = Buffer.from(encoded, "base64url").toString("hex");
  return SHA256_HEX.test(digest) ? digest : null;
}
