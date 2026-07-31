# Security policy

## Reporting a vulnerability

Do not open a public issue for an undisclosed vulnerability or exposed credential. Use GitHub's private vulnerability reporting for this repository, or contact the repository owner privately if that option is unavailable.

Never include funded Hedera private keys, recovery material, populated `.env` files, or raw paid-request bodies in a report.

## Automated controls

Pull requests run three required checks:

- `Quality`: clean install, unit/API tests, typecheck, and production build.
- `Dependency review`: blocks newly introduced high or critical dependency advisories.
- `Secret scan`: scans repository history with Gitleaks.

GitHub secret scanning and push protection are also enabled for the public repository. Dependabot monitors npm and GitHub Actions dependencies weekly.

## Accepted transitive risk

As of 2026-07-31, `npm audit --omit=dev` reports advisories inherited through the versions of `@hiero-ledger/sdk` and `@hiero-ledger/proto` required by `@x402/hedera@2.20.0`. The remaining affected packages are `@grpc/grpc-js` and `protobufjs`; npm reports no compatible fix in the supported dependency tree.

ProofBound402 does not expose a gRPC server, load user-supplied protobuf schemas, or publish raw requests on-chain. It does parse payer-signed Hedera transaction bytes, so this residual risk remains tracked in GitHub issue #6 and must be reassessed when the official x402/Hedera dependency set updates.

The independently fixable `ws` advisory is overridden to a patched compatible release and covered by the full unit and live Hedera testnet suite.
