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

## Commands

```bash
npm test
npm run typecheck
npm run build
```

## Security scope

ProofBound402 does not claim a flaw in the x402 specification. It targets resource-server implementations that authorize delivery using settlement fields without binding that settlement to the full request context.
