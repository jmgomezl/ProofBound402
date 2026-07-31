# ProofBound402

**One payment. One exact request. Publicly provable.**

ProofBound402 is a Hedera-native hardening layer for x402 integrations. It binds a payment to the exact HTTP request it is allowed to unlock, verifies settlement independently, and produces a tamper-evident delivery receipt.

The attack lab deliberately includes an unbound integration to show how two endpoints with identical payment requirements can accept the same payment context. Protected mode commits the request binding to the Hedera transaction memo and rejects resource substitution, body tampering, expiry, and replay.

## Status

This repository is under active bounty development. The local simulator is the default; Hedera testnet mode is enabled only when credentials are configured.

See [REQUIREMENTS.md](./REQUIREMENTS.md) for the submission gate and product acceptance criteria.

## Development

```bash
npm install
cp .env.example .env
npm run dev
```

Open <http://localhost:5173>. The API listens on <http://localhost:4402>.

With no Hedera credentials, the UI and API run in visibly labeled simulation mode. Partial live configuration fails at startup instead of silently falling back.

## Hedera testnet mode

Live settlement uses the official `@x402/core` client and facilitator with `@x402/hedera`. Configure three distinct, funded testnet accounts:

- `HEDERA_PAYER_ACCOUNT_ID`: identifies the payer committed into the request binding.
- `HEDERA_PAYER_PRIVATE_KEY`: signs the transfer body for the self-driven dashboard demo and live integration test. A resource server accepting an external `PAYMENT-SIGNATURE` does not need this key.
- `HEDERA_FACILITATOR_ACCOUNT_ID` and `HEDERA_FACILITATOR_PRIVATE_KEY`: adds the fee-payer signature and submits the transaction.
- `PROOFBOUND_PAY_TO`: receives the x402 payment.

The recipient must differ from the facilitator so Mirror Node can verify the exact recipient credit independently from transaction fees. Set `PROOFBOUND_ASSET=0.0.0` for HBAR and express `PROOFBOUND_AMOUNT` in tinybars. Set `PROOFBOUND_RESOURCE_BASE_URL` to the public API origin when deployed.

Create and fund accounts through the [Hedera Portal](https://portal.hedera.com/), populate `.env`, export those variables in the server process, then run `npm run dev`. The dashboard switches from `SIMULATION` to `LIVE` automatically.

The live integration test transfers testnet funds and therefore requires an explicit opt-in:

```bash
set -a
source .env
set +a
npm run test:live
```

The protected HTTP boundary is `POST /api/resources/basic` or `POST /api/resources/premium`. An unpaid request returns HTTP 402 with a base64-encoded `PAYMENT-REQUIRED` header. Retry with the x402 v2 payload in `PAYMENT-SIGNATURE`.

## Commands

```bash
npm test
npm run test:live # explicit testnet transfer
npm run typecheck
npm run build
```

## Security scope

ProofBound402 does not claim a flaw in the x402 specification. It targets resource-server implementations that authorize delivery using settlement fields without binding that settlement to the full request context.
