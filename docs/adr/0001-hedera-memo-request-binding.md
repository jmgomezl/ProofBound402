# ADR 0001: Bind x402 payments to HTTP requests in the Hedera transaction memo

- Status: Accepted
- Date: 2026-07-31
- Owners: ProofBound402 maintainers

## Context

An x402 resource server can expose multiple resources with identical amount, asset, and recipient requirements. An integration that authorizes delivery from those settlement fields alone cannot prove which HTTP request the payer intended to unlock.

## Decision

ProofBound402 computes a canonical SHA-256 digest over:

- HTTP method
- normalized resource path and query
- request-body SHA-256
- amount, asset, and recipient
- payer and Hedera network
- one-time nonce and expiry

The complete 32-byte digest is base64url encoded as `pb402:v1:<digest>` and written to the Hedera `TransferTransaction` memo before the payer signs it. The resource server extracts that signed memo, recomputes the binding from the actual inbound request, and consumes the nonce only after all invariants match.

The full evidence object is published separately to HCS after settlement. Raw request bodies and secrets are never written to public ledger data.

## Consequences

- A payment cannot be transplanted to another resource, method, body, payer, network, or payment terms without rejection.
- The memo remains under Hedera's 100-byte transaction memo limit.
- Client and resource server must share an exact canonicalization version.
- Hosted facilitators do not need to understand the binding, but the resource server must verify it before delivery.
- Replay prevention still requires an atomic nonce store; the memo alone is insufficient.
