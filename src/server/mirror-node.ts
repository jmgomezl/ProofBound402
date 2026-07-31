import { setTimeout as delay } from "node:timers/promises";

interface MirrorTransfer {
  account: string;
  amount: number | string;
}

interface MirrorTransaction {
  consensus_timestamp: string;
  memo_base64: string | null;
  result: string;
  transaction_id: string;
  transfers?: MirrorTransfer[];
  token_transfers?: Array<MirrorTransfer & { token_id: string }>;
}

interface MirrorTransactionResponse {
  transactions?: MirrorTransaction[];
}

export interface MirrorSettlementExpectation {
  transactionId: string;
  memo: string;
  payer: string;
  payTo: string;
  asset: string;
  amount: string;
}

export interface MirrorSettlementEvidence {
  transactionId: string;
  consensusTimestamp: string;
  memo: string;
  result: "SUCCESS";
}

export interface MirrorVerificationOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  maxAttempts?: number;
  intervalMs?: number;
}

export function toMirrorTransactionId(transactionId: string): string {
  const match = /^(\d+\.\d+\.\d+)@(\d+)\.(\d+)$/.exec(transactionId);
  if (!match) {
    throw new Error("Invalid Hedera transaction ID");
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function netForAccount(transfers: MirrorTransfer[], account: string): bigint {
  return transfers
    .filter((transfer) => transfer.account === account)
    .reduce((total, transfer) => {
      if (typeof transfer.amount === "number" && !Number.isSafeInteger(transfer.amount)) {
        throw new Error("Mirror Node returned an unsafe numeric transfer amount");
      }
      return total + BigInt(transfer.amount);
    }, 0n);
}

function verifyTransaction(
  transaction: MirrorTransaction,
  expected: MirrorSettlementExpectation,
): MirrorSettlementEvidence {
  if (transaction.result !== "SUCCESS") {
    throw new Error(`Mirror Node reports transaction result ${transaction.result}`);
  }

  const memo = transaction.memo_base64
    ? Buffer.from(transaction.memo_base64, "base64").toString("utf8")
    : "";
  if (memo !== expected.memo) {
    throw new Error("Mirror Node memo does not match the request binding");
  }

  const amount = BigInt(expected.amount);
  const transfers = expected.asset === "0.0.0"
    ? transaction.transfers ?? []
    : (transaction.token_transfers ?? []).filter((transfer) => transfer.token_id === expected.asset);
  if (netForAccount(transfers, expected.payer) !== -amount) {
    throw new Error("Mirror Node payer debit does not match the x402 requirement");
  }
  if (netForAccount(transfers, expected.payTo) !== amount) {
    throw new Error("Mirror Node recipient credit does not match the x402 requirement");
  }

  return {
    transactionId: expected.transactionId,
    consensusTimestamp: transaction.consensus_timestamp,
    memo,
    result: "SUCCESS",
  };
}

export async function waitForMirrorSettlement(
  expected: MirrorSettlementExpectation,
  options: MirrorVerificationOptions = {},
): Promise<MirrorSettlementEvidence> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl ?? "https://testnet.mirrornode.hedera.com";
  const maxAttempts = options.maxAttempts ?? 12;
  const intervalMs = options.intervalMs ?? 1_000;
  const mirrorTransactionId = toMirrorTransactionId(expected.transactionId);
  const url = `${baseUrl}/api/v1/transactions/${mirrorTransactionId}`;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetchImpl(url, { headers: { accept: "application/json" } });
    if (!response.ok) {
      if (attempt === maxAttempts) {
        throw new Error(`Mirror Node lookup failed with status ${response.status}`);
      }
    } else {
      const body = (await response.json()) as MirrorTransactionResponse;
      const transaction = body.transactions?.find(
        (candidate) => candidate.transaction_id === expected.transactionId,
      ) ?? body.transactions?.[0];
      if (transaction) {
        return verifyTransaction(transaction, expected);
      }
    }

    if (attempt < maxAttempts) {
      await delay(intervalMs);
    }
  }

  throw new Error("Transaction did not appear on Mirror Node before the verification deadline");
}
