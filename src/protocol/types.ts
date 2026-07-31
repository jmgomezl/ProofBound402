export const BINDING_VERSION = "pb402-v1" as const;
export const MEMO_PREFIX = "pb402:v1:" as const;

export interface RequestIntent {
  method: string;
  resource: string;
  body?: unknown;
  amount: string;
  asset: string;
  payTo: string;
  payer: string;
  network: string;
}

export interface BindingClaims {
  version: typeof BINDING_VERSION;
  method: string;
  resource: string;
  bodySha256: string;
  amount: string;
  asset: string;
  payTo: string;
  payer: string;
  network: string;
  nonce: string;
  expiresAt: number;
}

export interface BindingChallenge {
  id: string;
  claims: BindingClaims;
  digest: string;
  memo: string;
  status: "issued" | "consumed";
  consumedAt?: number;
}

export type VerificationCode =
  | "BOUND"
  | "MALFORMED_MEMO"
  | "UNKNOWN_CHALLENGE"
  | "EXPIRED"
  | "REPLAY"
  | "MEMO_MISMATCH"
  | "METHOD_MISMATCH"
  | "RESOURCE_MISMATCH"
  | "BODY_MISMATCH"
  | "PAYMENT_TERMS_MISMATCH"
  | "PAYER_MISMATCH"
  | "NETWORK_MISMATCH";

export interface VerificationResult {
  ok: boolean;
  code: VerificationCode;
  message: string;
  expectedDigest?: string;
  actualDigest?: string;
}
