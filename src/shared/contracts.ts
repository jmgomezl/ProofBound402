export const DEMO_RESOURCES = {
  basic: {
    id: "basic",
    label: "Market pulse",
    path: "/reports/market-pulse",
    description: "A five-line market summary.",
  },
  premium: {
    id: "premium",
    label: "Alpha dossier",
    path: "/reports/alpha-dossier",
    description: "The protected high-value research payload.",
  },
} as const;

export type ResourceId = keyof typeof DEMO_RESOURCES;
export type ChainMode = "simulated" | "testnet";

export type DemoEventKind =
  | "challenge.issued"
  | "payment.created"
  | "attack.accepted"
  | "attack.blocked"
  | "request.delivered"
  | "settlement.confirmed"
  | "receipt.published";

export interface DemoEvent {
  id: string;
  at: string;
  kind: DemoEventKind;
  title: string;
  detail: string;
  tone: "neutral" | "danger" | "success";
  proof?: Record<string, string>;
}

export interface DemoState {
  mode: ChainMode;
  events: DemoEvent[];
  activeChallenge?: {
    id: string;
    resource: ResourceId;
    memo: string;
    digest: string;
    nonce: string;
    expiresAt: number;
    status: "issued" | "reserved" | "consumed";
    paymentRequired: {
      x402Version: number;
      resource: string;
      scheme: string;
      network: string;
      amount: string;
      asset: string;
      payTo: string;
      feePayer: string;
    };
  };
  evidence?: {
    transactionId: string;
    consensusTimestamp: string;
    memo: string;
    hcsTopicId?: string;
    hcsSequenceNumber?: string;
    hashscanTransactionUrl?: string;
    hashscanTopicUrl?: string;
  };
}

export interface ApiResult {
  ok: boolean;
  code: string;
  message: string;
  state: DemoState;
}
