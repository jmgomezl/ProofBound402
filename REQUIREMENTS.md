# ProofBound402 requirements

Last verified against the official Hedera bounty page: 2026-07-31.

## Bounty submission gate

- [x] Public, open-source GitHub repository.
- [x] Working end-to-end x402 flow using Hedera rails.
- [x] Real Hedera testnet transactions in HBAR or USDC.
- [x] HashScan links for the relevant transactions (see [EVIDENCE.md](./EVIDENCE.md)).
- [ ] Demo video under five minutes showing the complete flow and on-chain payments.
- [ ] Submission form completed before July 31 at 11:59 PM ET.

Source: <https://hedera.com/x402-bounty/>

## Product acceptance criteria

- [x] A paid request is bound to HTTP method, normalized resource URL, request-body hash, amount, asset, recipient, payer, nonce, network, and expiry.
- [x] The binding digest is carried in a Hedera transaction memo as `pb402:v1:<digest>`.
- [x] A payment for one resource cannot unlock another resource with otherwise identical payment requirements.
- [x] A binding cannot be redeemed twice.
- [x] Expired, malformed, unknown, and altered bindings fail closed with machine-readable reasons.
- [x] Successful settlement is confirmed independently through Hedera Mirror Node.
- [x] Public evidence never contains the raw request body or secret credentials.

## Demo acceptance criteria

- [x] Reset produces a deterministic starting state.
- [x] "Unbound" mode visibly reproduces a cross-resource payment transplant.
- [x] "Proof-bound" mode rejects the same transplant and explains the exact failed invariant.
- [x] A valid proof-bound request settles successfully.
- [x] The dashboard exposes memo digest, request digest, nonce state, transaction ID, and consensus timestamp.
- [x] Live mode provides working HashScan links; simulation mode is unmistakably labeled.
- [x] The complete judge path can be demonstrated in under three minutes, leaving time to explain implementation.

## Security invariants

1. Canonicalization is deterministic across client and resource server.
2. Nonces are random, short-lived, resource scoped, and consumed atomically.
3. The full SHA-256 digest is used in the memo; no security decision relies on a truncated display value.
4. Settlement success alone never authorizes delivery; the request binding must also match.
5. Mirror Node confirmation is evidence, not the sole replay lock.
6. The demo never claims an official x402 protocol vulnerability; it demonstrates a dangerous integration pattern and its Hedera-native hardening layer.

## Delivery checklist

- [x] Architecture and threat-model documentation.
- [x] Unit tests for canonicalization, memo parsing, tampering, expiry, and replay.
- [x] API integration test covering exploit, rejection, and successful redemption.
- [x] `.env.example` with no secrets.
- [x] Testnet setup and funding instructions.
- [x] Recorded transaction identifiers in `EVIDENCE.md`.
- [x] Demo script and submission copy (see [docs/DEMO-SCRIPT.md](./docs/DEMO-SCRIPT.md)).

## Future work

- Publish an HCS message per delivery so the full request/payment/delivery evidence trail is tamper-evident on-chain. HCS receipts must contain hashes and public metadata only — never the raw request body.
