import { createHash } from "node:crypto";
import type { BindingClaims, RequestIntent } from "./types.js";
import { BINDING_VERSION } from "./types.js";

function normalizeJson(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Request bodies cannot contain non-finite numbers");
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeJson(item));
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));

    return Object.fromEntries(entries.map(([key, item]) => [key, normalizeJson(item)]));
  }

  throw new TypeError(`Unsupported request body value: ${typeof value}`);
}

export function stableJson(value: unknown): string {
  return JSON.stringify(normalizeJson(value));
}

export function sha256Hex(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hashBody(body: unknown): string {
  if (body === undefined || body === null) {
    return sha256Hex("");
  }

  if (typeof body === "string") {
    return sha256Hex(body);
  }

  if (body instanceof Uint8Array) {
    return sha256Hex(body);
  }

  return sha256Hex(stableJson(body));
}

export function normalizeResource(resource: string): string {
  const url = new URL(resource, "https://proofbound.invalid");
  const sorted = [...url.searchParams.entries()].sort(([leftKey, leftValue], [rightKey, rightValue]) => {
    const keyOrder = leftKey.localeCompare(rightKey);
    return keyOrder === 0 ? leftValue.localeCompare(rightValue) : keyOrder;
  });

  const query = new URLSearchParams(sorted).toString();
  return `${url.pathname}${query ? `?${query}` : ""}`;
}

export function buildClaims(
  intent: RequestIntent,
  nonce: string,
  expiresAt: number,
): BindingClaims {
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= 0) {
    throw new TypeError("expiresAt must be a positive Unix timestamp in milliseconds");
  }

  return {
    version: BINDING_VERSION,
    method: intent.method.toUpperCase(),
    resource: normalizeResource(intent.resource),
    bodySha256: hashBody(intent.body),
    amount: intent.amount,
    asset: intent.asset,
    payTo: intent.payTo,
    payer: intent.payer,
    network: intent.network,
    nonce,
    expiresAt,
  };
}

export function hashClaims(claims: BindingClaims): string {
  return sha256Hex(stableJson(claims));
}
