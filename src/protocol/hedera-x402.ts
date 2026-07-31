import type { PaymentRequirements } from "@x402/core/types";
import {
  AccountId,
  Hbar,
  PrivateKey,
  TokenId,
  Transaction,
  TransactionId,
  TransferTransaction,
  assertSupportedHederaNetwork,
  createHederaClient,
  isHbarAsset,
  type ClientHederaSigner,
  type HederaClientSignerConfig,
} from "@x402/hedera";
import { memoToDigest } from "./memo.js";

export const PROOFBOUND_EXTRA_KEY = "proofBound402";

interface ProofBoundExtra {
  memo: string;
  challengeId?: string;
}

function readProofBoundExtra(requirements: PaymentRequirements): ProofBoundExtra {
  const value = requirements.extra?.[PROOFBOUND_EXTRA_KEY];
  if (!value || typeof value !== "object") {
    throw new Error(`paymentRequirements.extra.${PROOFBOUND_EXTRA_KEY} is required`);
  }

  const memo = (value as Record<string, unknown>).memo;
  if (typeof memo !== "string" || !memoToDigest(memo)) {
    throw new Error("A valid ProofBound402 memo is required before payment signing");
  }

  const challengeId = (value as Record<string, unknown>).challengeId;
  return {
    memo,
    challengeId: typeof challengeId === "string" ? challengeId : undefined,
  };
}

/**
 * x402 Hedera client signer with the request commitment inside the signed
 * transaction body. The facilitator cannot alter the memo after payer signing.
 */
export function createProofBoundHederaSigner(
  accountId: string,
  privateKey: PrivateKey,
  config: HederaClientSignerConfig = {},
): ClientHederaSigner {
  const configuredNetwork = config.network ?? "hedera:testnet";
  assertSupportedHederaNetwork(configuredNetwork);
  const payer = AccountId.fromString(accountId);

  return {
    accountId: payer.toString(),
    createPartiallySignedTransferTransaction: async (requirements) => {
      assertSupportedHederaNetwork(requirements.network);
      if (requirements.network !== configuredNetwork) {
        throw new Error("Payment network differs from the signer network");
      }

      const feePayer = requirements.extra?.feePayer;
      if (typeof feePayer !== "string") {
        throw new Error("feePayer is required in paymentRequirements.extra");
      }

      const amount = BigInt(requirements.amount);
      if (amount <= 0n) {
        throw new Error("amount must be greater than zero");
      }

      const { memo } = readProofBoundExtra(requirements);
      const recipient = AccountId.fromString(requirements.payTo);
      const transaction = new TransferTransaction().setTransactionMemo(memo);

      if (isHbarAsset(requirements.asset)) {
        transaction.addHbarTransfer(payer, Hbar.fromTinybars((-amount).toString()));
        transaction.addHbarTransfer(recipient, Hbar.fromTinybars(amount.toString()));
      } else {
        const token = TokenId.fromString(requirements.asset);
        transaction.addTokenTransfer(token, payer, -amount);
        transaction.addTokenTransfer(token, recipient, amount);
      }

      transaction.setTransactionId(TransactionId.generate(AccountId.fromString(feePayer)));
      const client = createHederaClient(configuredNetwork, config.nodeUrl);
      try {
        transaction.freezeWith(client);
        const signed = await transaction.sign(privateKey);
        return Buffer.from(signed.toBytes()).toString("base64");
      } finally {
        client.close();
      }
    },
  };
}

export function extractProofBoundMemo(transactionBase64: string): string {
  const transaction = Transaction.fromBytes(Buffer.from(transactionBase64, "base64"));
  if (!(transaction instanceof TransferTransaction)) {
    throw new Error("ProofBound402 requires a Hedera TransferTransaction");
  }
  if (!memoToDigest(transaction.transactionMemo)) {
    throw new Error("Transaction does not contain a valid ProofBound402 memo");
  }
  return transaction.transactionMemo;
}

export function assertTransactionBinding(transactionBase64: string, expectedDigest: string): string {
  const memo = extractProofBoundMemo(transactionBase64);
  const actualDigest = memoToDigest(memo);
  if (actualDigest !== expectedDigest) {
    throw new Error("Transaction memo does not match the expected request binding");
  }
  return memo;
}
