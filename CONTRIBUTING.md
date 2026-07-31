# Contributing to ProofBound402

ProofBound402 uses GitHub issues, focused branches, and pull requests to keep every feature, bug, and security decision traceable.

## Workflow

1. Open or select an issue before implementation.
2. Branch from `main` using `feat/<issue>-short-name`, `fix/<issue>-short-name`, or `docs/<issue>-short-name`.
3. Keep commits focused and use Conventional Commit prefixes: `feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`.
4. Reference the issue in the pull request with `Closes #<issue>` when appropriate.
5. Record user-visible changes in `CHANGELOG.md` and architecture/security decisions in `docs/adr/`.
6. Require `npm test`, `npm run typecheck`, and `npm run build` before merge.

## Security changes

Security-relevant pull requests must state:

- The invariant being protected.
- The attack or failure mode covered.
- Why the behavior fails closed.
- The new or changed tests.
- Any public data written to Hedera transaction memos or HCS.

Never commit Hedera private keys, account recovery material, or populated `.env` files.
