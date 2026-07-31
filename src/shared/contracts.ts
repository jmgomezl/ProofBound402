export const DEMO_RESOURCES = {
  basic: {
    id: "basic",
    label: "Market pulse",
    path: "/reports/market-pulse",
    description: "A five-line market summary.",
    content: [
      "HBAR steady; agent-driven API spend up 14% week over week.",
      "x402 adoption: three new facilitators came online this week.",
      "Micropayments under one cent now 38% of metered API calls.",
      "Settlement finality on Hedera keeps per-request pricing viable.",
      "Outlook: paid agent traffic keeps compounding.",
    ],
  },
  premium: {
    id: "premium",
    label: "Alpha dossier",
    path: "/reports/alpha-dossier",
    description: "The protected high-value research payload.",
    content: [
      "CONFIDENTIAL — delivered only against a matching payment label.",
      "Deep dive: pricing power in machine-to-machine commerce.",
      "Finding: agents renegotiate API terms in milliseconds; rails must keep up.",
      "Thesis: request-bound payments become the default settlement pattern.",
    ],
  },
} as const;

export type ResourceId = keyof typeof DEMO_RESOURCES;
export type ChainMode = "simulated" | "testnet";

export interface DeliveredReport {
  resource: ResourceId;
  content: readonly string[];
}

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
  deliveredReport?: DeliveredReport;
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
