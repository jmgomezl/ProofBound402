import { createHash, randomInt } from "node:crypto";
import type { BindingClaims } from "../protocol/types.js";

export interface SettlementEvidence {
  transactionId: string;
  consensusTimestamp: string;
  memo: string;
  hcsTopicId: string;
  hcsSequenceNumber: string;
  hashscanTransactionUrl?: string;
  hashscanTopicUrl?: string;
}

export interface SettlementAdapter {
  readonly mode: "simulated" | "testnet";
  settle(memo: string, claims: BindingClaims): Promise<SettlementEvidence>;
}

export class SimulatedSettlementAdapter implements SettlementAdapter {
  readonly mode = "simulated" as const;

  async settle(memo: string, claims: BindingClaims): Promise<SettlementEvidence> {
    const seconds = Math.floor(Date.now() / 1_000);
    const nanos = randomInt(100_000_000, 999_999_999);
    const evidenceHash = createHash("sha256")
      .update(`${memo}:${claims.nonce}:${seconds}.${nanos}`)
      .digest("hex");

    return {
      transactionId: `0.0.402402@${seconds}.${nanos}`,
      consensusTimestamp: `${seconds}.${nanos}`,
      memo,
      hcsTopicId: "0.0.402402",
      hcsSequenceNumber: String(Number.parseInt(evidenceHash.slice(0, 6), 16)),
    };
  }
}
