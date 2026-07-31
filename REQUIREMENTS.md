# ProofBound402 requirements

Last verified against the official Hedera bounty page: 2026-07-31.

## Bounty submission gate

- [ ] Public, open-source GitHub repository.
- [ ] Working end-to-end x402 flow using Hedera rails.
- [ ] Real Hedera testnet transactions in HBAR or USDC.
- [ ] HashScan links for the relevant transactions.
- [ ] Demo video under five minutes showing the complete flow and on-chain payments.
- [ ] Submission form completed before July 31 at 11:59 PM ET.

Source: <https://hedera.com/x402-bounty/>

## Product acceptance criteria

- [ ] A paid request is bound to HTTP method, normalized resource URL, request-body hash, amount, asset, recipient, payer, nonce, network, and expiry.
- [ ] The binding digest is carried in a Hedera transaction memo as `pb402:v1:<digest>`.
- [ ] A payment for one resource cannot unlock another resource with otherwise identical payment requirements.
- [ ] A binding cannot be redeemed twice.
- [ ] Expired, malformed, unknown, and altered bindings fail closed with machine-readable reasons.
- [ ] Successful settlement is confirmed independently through Hedera Mirror Node.
- [ ] An HCS message records the full, tamper-evident request/payment/delivery evidence.
- [ ] Public evidence never contains the raw request body or secret credentials.

## Demo acceptance criteria

- [ ] Reset produces a deterministic starting state.
- [ ] "Unbound" mode visibly reproduces a cross-resource payment transplant.
- [ ] "Proof-bound" mode rejects the same transplant and explains the exact failed invariant.
- [ ] A valid proof-bound request settles successfully.
- [ ] The dashboard exposes memo digest, request digest, nonce state, transaction ID, consensus timestamp, and HCS receipt.
- [ ] Live mode provides working HashScan links; simulation mode is unmistakably labeled.
- [ ] The complete judge path can be demonstrated in under three minutes, leaving time to explain implementation.

## Security invariants

1. Canonicalization is deterministic across client and resource server.
2. Nonces are random, short-lived, resource scoped, and consumed atomically.
3. The full SHA-256 digest is used in the memo; no security decision relies on a truncated display value.
4. Settlement success alone never authorizes delivery; the request binding must also match.
5. Mirror Node confirmation is evidence, not the sole replay lock.
6. HCS receipts contain hashes and public metadata only.
7. The demo never claims an official x402 protocol vulnerability; it demonstrates a dangerous integration pattern and its Hedera-native hardening layer.

## Delivery checklist

- [ ] Architecture and threat-model documentation.
- [ ] Unit tests for canonicalization, memo parsing, tampering, expiry, and replay.
- [ ] API integration test covering exploit, rejection, and successful redemption.
- [ ] `.env.example` with no secrets.
- [ ] Testnet setup and funding instructions.
- [ ] Recorded transaction and HCS topic identifiers in `EVIDENCE.md`.
- [ ] Demo script and submission copy.
