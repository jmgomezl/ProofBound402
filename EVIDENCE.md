# Hedera Testnet Evidence

ProofBound402 completed an end-to-end x402 payment on Hedera testnet on 2026-07-31. The live integration test constructed the payment from an HTTP request commitment, submitted it through the x402 Hedera facilitator, and accepted it only after Mirror Node confirmed the memo and transfer amounts.

| Field | Verified value |
| --- | --- |
| Result | `SUCCESS` |
| SDK transaction ID | `0.0.9859769@1785521551.549343245` |
| Mirror transaction ID | `0.0.9859769-1785521551-549343245` |
| Consensus timestamp | `1785521559.411017633` |
| Memo | `pb402:v1:_ovt94J88nYyHb0vHkLxJXYGv_8hk7upJqUBfT-5o4s` |
| Payer debit | `0.0.7231440`: `-1,000,000` tinybar |
| Recipient credit | `0.0.9859771`: `+1,000,000` tinybar |
| Explorer | [HashScan transaction](https://hashscan.io/testnet/transaction/0.0.9859769-1785521551-549343245) |
| API evidence | [Hedera Mirror Node](https://testnet.mirrornode.hedera.com/api/v1/transactions/0.0.9859769-1785521551-549343245) |

## The flow is repeatable

A later dashboard-driven settlement on the same day, independently verified the same way:

| Field | Verified value |
| --- | --- |
| Result | `SUCCESS` |
| Mirror transaction ID | `0.0.9859769-1785531587-393752447` |
| Consensus timestamp | `1785531594.016847104` |
| Memo | `pb402:v1:7gW57glVd5hWdHRKHd-Wm22r9QGqiPtyGcf_dz5xqVk` |
| Explorer | [HashScan transaction](https://hashscan.io/testnet/transaction/0.0.9859769-1785531587-393752447) |
| API evidence | [Hedera Mirror Node](https://testnet.mirrornode.hedera.com/api/v1/transactions/0.0.9859769-1785531587-393752447) |

Each run commits a different binding digest, so each on-chain memo is unique to its request.

Run the opt-in integration test with funded testnet roles in the ignored `.env`:

```bash
npm run test:live
```

The test fails unless Mirror Node independently confirms all of the following:

- Hedera consensus result is `SUCCESS`.
- The on-chain memo equals the request-binding memo.
- The payer's net debit equals the x402 amount.
- The recipient's net credit equals the x402 amount.
- The transfer uses the required HBAR or HTS asset.

Private keys are not part of this evidence and must never be committed.
