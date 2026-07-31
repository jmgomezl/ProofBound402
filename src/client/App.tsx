import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  CircleDot,
  ExternalLink,
  FileCheck2,
  Fingerprint,
  FlaskConical,
  LockKeyhole,
  Play,
  Radio,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEMO_RESOURCES,
  type ApiResult,
  type DemoEvent,
  type DemoState,
  type ResourceId,
} from "../shared/contracts";

const EMPTY_STATE: DemoState = { mode: "simulated", events: [] };

const FRIENDLY_RESULTS: Record<string, string> = {
  CHALLENGE_ISSUED: "Purchase protected. Its one-time fingerprint is ready.",
  RESOURCE_MISMATCH: "Blocked. This payment belongs to a different report.",
  DELIVERED: "Payment verified. The intended report is unlocked.",
  UNBOUND_ATTACK_ACCEPTED: "Risk confirmed. One payment unlocked the wrong report.",
  RESET: "Demo cleared.",
};

async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json()) as T;
  if (!response.ok) {
    throw new Error((data as { message?: string }).message ?? `Request failed: ${response.status}`);
  }
  return data;
}

function shorten(value: string, head = 15, tail = 10): string {
  return value.length <= head + tail + 3 ? value : `${value.slice(0, head)}...${value.slice(-tail)}`;
}

function formatAmount(amount = "1000000", asset = "0.0.0"): string {
  if (asset !== "0.0.0") return `${amount} token units`;
  const tinybars = BigInt(amount);
  const whole = tinybars / 100_000_000n;
  const fraction = (tinybars % 100_000_000n).toString().padStart(8, "0").replace(/0+$/, "");
  return `${whole}${fraction ? `.${fraction}` : ""} HBAR`;
}

function EventIcon({ event }: { event: DemoEvent }) {
  if (event.kind === "attack.accepted") return <AlertTriangle size={16} />;
  if (event.kind === "attack.blocked") return <ShieldCheck size={16} />;
  if (event.kind === "receipt.published") return <Fingerprint size={16} />;
  if (event.tone === "success") return <Check size={16} />;
  return <CircleDot size={16} />;
}

function ActionButton({
  children,
  icon,
  disabled,
  onClick,
  variant = "dark",
  testId,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  variant?: "dark" | "signal" | "outline";
  testId?: string;
}) {
  return (
    <button
      className={`action action--${variant}`}
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

function ProgressStep({
  number,
  title,
  detail,
  state,
}: {
  number: number;
  title: string;
  detail: string;
  state: "waiting" | "active" | "done";
}) {
  return (
    <li className={`progress-step progress-step--${state}`}>
      <span className="progress-step__marker">{state === "done" ? <Check size={15} /> : number}</span>
      <div>
        <b>{title}</b>
        <span>{detail}</span>
      </div>
    </li>
  );
}

export function App() {
  const [state, setState] = useState<DemoState>(EMPTY_STATE);
  const [selectedResource, setSelectedResource] = useState<ResourceId>("basic");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    tone: "ok" | "error";
    text: string;
    code?: string;
  } | null>(null);

  useEffect(() => {
    request<DemoState>("/api/demo/state").then(setState).catch((error: Error) => {
      setNotice({ tone: "error", text: error.message });
    });
  }, []);

  useEffect(() => {
    if (state.activeChallenge) setSelectedResource(state.activeChallenge.resource);
  }, [state.activeChallenge?.id, state.activeChallenge?.resource]);

  const run = useCallback(async (name: string, path: string, body: unknown = {}) => {
    setBusy(name);
    setNotice(null);
    try {
      const result = await request<ApiResult>(path, body);
      setState(result.state);
      setNotice({
        tone: result.ok ? "ok" : "error",
        text: FRIENDLY_RESULTS[result.code] ?? result.message,
        code: result.code,
      });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Request failed" });
    } finally {
      setBusy(null);
    }
  }, []);

  const challenge = state.activeChallenge;
  const paymentTerms = challenge?.paymentRequired;
  const activeEvents = useMemo(() => {
    let start = -1;
    for (let index = state.events.length - 1; index >= 0; index -= 1) {
      if (state.events[index].kind === "challenge.issued") {
        start = index;
        break;
      }
    }
    return start < 0 ? [] : state.events.slice(start);
  }, [state.events]);
  const reuseBlocked = activeEvents.some((event) => event.kind === "attack.blocked");
  const delivered = challenge?.status === "consumed";
  const guidedStep = !challenge ? 0 : delivered ? 3 : reuseBlocked ? 2 : 1;
  const selected = DEMO_RESOURCES[selectedResource];
  const alternate = DEMO_RESOURCES[selectedResource === "basic" ? "premium" : "basic"];
  const price = formatAmount(paymentTerms?.amount, paymentTerms?.asset);
  const latestDecision = useMemo(
    () => [...state.events].reverse().find((item) => item.kind.startsWith("attack.")),
    [state.events],
  );

  const runNextStep = () => {
    if (guidedStep === 0) {
      void run("issue", "/api/demo/bound-challenge", { resource: selectedResource });
    } else if (guidedStep === 1) {
      void run("bound", "/api/demo/bound-attack");
    } else if (guidedStep === 2) {
      void run("settle", "/api/demo/bound-settle");
    }
  };

  const nextAction = guidedStep === 0
    ? `Protect ${selected.label}`
    : guidedStep === 1
      ? `Try it on ${alternate.label}`
      : guidedStep === 2
        ? `${state.mode === "testnet" ? `Pay ${price} & unlock` : "Simulate payment & unlock"}`
        : "Report unlocked";

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true"><span>402</span></span>
          <div>
            <strong>ProofBound402</strong>
            <span>Hedera request integrity</span>
          </div>
        </div>
        <div className="network" aria-label={`Hedera testnet ${state.mode}`}>
          <span className={`network__light network__light--${state.mode}`} />
          <span>HEDERA TESTNET</span>
          <b>{state.mode === "testnet" ? "LIVE" : "DEMO"}</b>
        </div>
        <button
          className="icon-button"
          title="Reset demo"
          aria-label="Reset demo"
          onClick={() => run("reset", "/api/demo/reset")}
          disabled={busy !== null}
          type="button"
        >
          <RotateCcw size={18} />
        </button>
      </header>

      <main>
        <section className="intro">
          <div className="intro__copy">
            <span className="eyebrow">PAYMENT PROOF / HEDERA</span>
            <h1>ProofBound402</h1>
            <p>A payment that unlocks only the exact request it was made for.</p>
          </div>
          <div className="promise" aria-label="ProofBound402 authorization flow">
            <span><WalletCards size={18} /><b>Choose</b><small>a request</small></span>
            <ArrowRight size={16} />
            <span><Fingerprint size={18} /><b>Fingerprint</b><small>the intent</small></span>
            <ArrowRight size={16} />
            <span><FileCheck2 size={18} /><b>Unlock</b><small>only that request</small></span>
          </div>
        </section>

        <section className="comparison" aria-labelledby="comparison-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">THE DIFFERENCE</span>
              <h2 id="comparison-title">What does the payment actually authorize?</h2>
            </div>
            <p>Two reports. Same price. Only one payment check knows which was purchased.</p>
          </div>

          <div className="comparison-grid">
            <article className="scenario scenario--unsafe">
              <div className="scenario__header">
                <span className="scenario__number">01</span>
                <span className="risk"><AlertTriangle size={14} /> WITHOUT REQUEST PROOF</span>
              </div>
              <h3>A receipt can be reused</h3>
              <p className="scenario__lead">An ordinary check sees the same price and recipient for both reports.</p>
              <div className="receipt-compare">
                <div><span>PAID FOR</span><b>Market pulse</b><code>{price}</code></div>
                <ArrowRight size={18} />
                <div className="receipt-compare__wrong"><span>UNLOCKS</span><b>Alpha dossier</b><code>SAME TERMS</code></div>
              </div>
              <div className="outcome outcome--danger">
                <AlertTriangle size={17} />
                <span><b>Wrong report delivered</b><small>The server cannot tell the requests apart.</small></span>
              </div>
              <ActionButton
                icon={<Play size={16} fill="currentColor" />}
                onClick={() => run("unbound", "/api/demo/unbound-attack")}
                disabled={busy !== null}
                testId="show-risk"
              >
                {busy === "unbound" ? "Checking..." : "Show the risk"}
              </ActionButton>
            </article>

            <article className="scenario scenario--bound">
              <div className="scenario__header">
                <span className="scenario__number">02</span>
                <span className="guard"><LockKeyhole size={14} /> PROOFBOUND</span>
              </div>
              <h3>One payment, one report</h3>
              <p className="scenario__lead">The payment carries a unique fingerprint for the intended request.</p>

              <div className="resource-picker" role="group" aria-label="Report to protect">
                {(Object.keys(DEMO_RESOURCES) as ResourceId[]).map((resourceId) => (
                  <button
                    type="button"
                    key={resourceId}
                    aria-pressed={selectedResource === resourceId}
                    onClick={() => setSelectedResource(resourceId)}
                    disabled={busy !== null || Boolean(challenge)}
                  >
                    <span>{DEMO_RESOURCES[resourceId].label}</span>
                    <small>{DEMO_RESOURCES[resourceId].description}</small>
                  </button>
                ))}
              </div>

              <ol className="progress-list">
                <ProgressStep
                  number={1}
                  title="Protect the purchase"
                  detail={`${selected.label} gets a one-time request fingerprint.`}
                  state={guidedStep === 0 ? "active" : "done"}
                />
                <ProgressStep
                  number={2}
                  title="Test payment reuse"
                  detail={`Try the fingerprint on ${alternate.label}.`}
                  state={guidedStep < 1 ? "waiting" : guidedStep === 1 ? "active" : "done"}
                />
                <ProgressStep
                  number={3}
                  title="Unlock the intended report"
                  detail={state.mode === "testnet" ? `Submit a ${price} Hedera testnet payment.` : "Verify the exact request in demo mode."}
                  state={guidedStep < 2 ? "waiting" : guidedStep === 2 ? "active" : "done"}
                />
              </ol>

              <div className="guided-action">
                {guidedStep === 2 && state.mode === "testnet" && (
                  <p><Radio size={13} /> This submits a real Hedera testnet transaction.</p>
                )}
                <ActionButton
                  icon={guidedStep === 0
                    ? <Fingerprint size={16} />
                    : guidedStep === 1
                      ? <ShieldCheck size={16} />
                      : <Check size={16} />}
                  variant="signal"
                  onClick={runNextStep}
                  disabled={busy !== null || guidedStep === 3}
                  testId="next-protected-step"
                >
                  {busy === "issue"
                    ? "Protecting..."
                    : busy === "bound"
                      ? "Testing reuse..."
                      : busy === "settle"
                        ? "Verifying payment..."
                        : nextAction}
                </ActionButton>
              </div>
            </article>
          </div>
        </section>

        <section className="result-band" aria-live="polite">
          <div className={`result-band__mark ${delivered || reuseBlocked ? "is-success" : ""}`}>
            {delivered || reuseBlocked ? <ShieldCheck size={26} /> : <CircleDot size={26} />}
          </div>
          <div>
            <span className="eyebrow">PROTECTED RESULT</span>
            <h2>{delivered ? `${selected.label} unlocked` : reuseBlocked ? "Wrong-report reuse blocked" : challenge ? "Purchase fingerprint ready" : "Ready to protect a purchase"}</h2>
            <p>{delivered
              ? "The payment matched the intended request and the one-time authorization is now consumed."
              : reuseBlocked
                ? `${alternate.label} was denied because its request does not match the payment fingerprint.`
                : challenge
                  ? "The request, payment terms, payer, expiry, and one-time nonce are bound together."
                  : "Choose a report above to create its one-time authorization."}</p>
          </div>
          <span className={`decision-pill ${latestDecision?.tone === "danger" ? "decision-pill--danger" : ""}`}>
            {delivered ? "DELIVERED" : reuseBlocked ? "BLOCKED" : challenge ? "PROTECTED" : "WAITING"}
          </span>
        </section>

        <section className="evidence-grid">
          <div className="trace-panel">
            <div className="panel-heading">
              <div><FlaskConical size={17} /><h2>What happened</h2></div>
              <span>{state.events.length.toString().padStart(2, "0")} EVENTS</span>
            </div>
            <div className="timeline">
              {state.events.length === 0 ? (
                <div className="empty-trace"><CircleDot size={18} /><span>Actions and decisions will appear here.</span></div>
              ) : (
                state.events.map((item, index) => (
                  <article className={`trace trace--${item.tone}`} key={item.id}>
                    <div className="trace__rail"><EventIcon event={item} /><span /></div>
                    <div className="trace__body">
                      <div className="trace__meta"><span>{String(index + 1).padStart(2, "0")}</span><time>{new Date(item.at).toLocaleTimeString([], { hour12: false })}</time></div>
                      <h3>{item.title}</h3>
                      <p>{item.detail}</p>
                      {item.proof && (
                        <details className="event-proof">
                          <summary>Proof fields <ChevronDown size={13} /></summary>
                          <div className="proof-row">
                            {Object.entries(item.proof).map(([key, value]) => (
                              <span key={key}><b>{key}</b><code title={value}>{shorten(value, 20, 12)}</code></span>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>

          <aside className="public-proof">
            <div className="panel-heading">
              <div><ReceiptText size={17} /><h2>Public evidence</h2></div>
              <span>{state.evidence ? "VERIFIED" : "PENDING"}</span>
            </div>
            <div className="public-proof__body">
              <div className="chain-proof__status">
                <span className={state.evidence ? "is-ready" : ""}><Check size={13} /></span>
                <p><b>Hedera transaction</b><code>{state.evidence ? shorten(state.evidence.transactionId, 18, 12) : "Awaiting settlement"}</code></p>
                {state.evidence?.hashscanTransactionUrl && <a href={state.evidence.hashscanTransactionUrl} target="_blank" rel="noreferrer" title="Open transaction in HashScan"><ExternalLink size={15} /></a>}
              </div>
              <div className="chain-proof__status">
                <span className={state.evidence?.hcsTopicId ? "is-ready" : ""}><Check size={13} /></span>
                <p><b>Delivery receipt</b><code>{state.evidence?.hcsTopicId ? `HCS ${state.evidence.hcsTopicId} / ${state.evidence.hcsSequenceNumber}` : "HCS receipt pending / issue #2"}</code></p>
                {state.evidence?.hashscanTopicUrl && <a href={state.evidence.hashscanTopicUrl} target="_blank" rel="noreferrer" title="Open topic in HashScan"><ExternalLink size={15} /></a>}
              </div>
              {state.mode === "simulated" && <p className="simulation-note">DEMO IDS ONLY / TESTNET CREDENTIALS ENABLE PUBLIC SUBMISSION</p>}
            </div>
          </aside>
        </section>

        <details className="technical-panel">
          <summary>
            <span><Fingerprint size={17} /><b>Technical proof</b></span>
            <span>REQUEST + X402 + HEDERA <ChevronDown size={15} /></span>
          </summary>
          <dl>
            <div><dt>Protected request</dt><dd>{paymentTerms?.resource ?? DEMO_RESOURCES[selectedResource].path}</dd></div>
            <div><dt>Binding digest</dt><dd title={challenge?.digest}>{challenge ? challenge.digest : "-"}</dd></div>
            <div><dt>Hedera memo</dt><dd title={challenge?.memo}>{challenge?.memo ?? "-"}</dd></div>
            <div><dt>x402 requirement</dt><dd>{paymentTerms ? `V${paymentTerms.x402Version} / ${paymentTerms.scheme.toUpperCase()} / ${paymentTerms.network}` : "-"}</dd></div>
            <div><dt>Asset and amount</dt><dd>{paymentTerms ? `${paymentTerms.asset} / ${paymentTerms.amount}` : "-"}</dd></div>
            <div><dt>Recipient</dt><dd>{paymentTerms?.payTo ?? "-"}</dd></div>
            <div><dt>Fee payer</dt><dd>{paymentTerms?.feePayer ?? "-"}</dd></div>
            <div><dt>One-time nonce</dt><dd title={challenge?.nonce}>{challenge?.nonce ?? "-"}</dd></div>
            <div><dt>Expires</dt><dd>{challenge ? new Date(challenge.expiresAt).toLocaleString() : "-"}</dd></div>
            <div><dt>Authorization state</dt><dd>{challenge?.status.toUpperCase() ?? "EMPTY"}</dd></div>
            <div><dt>Last decision</dt><dd className={latestDecision?.tone === "danger" ? "text-danger" : "text-success"}>{latestDecision?.proof?.decision ?? "-"}</dd></div>
            <div><dt>Enforced invariant</dt><dd>{latestDecision?.proof?.invariant ?? "-"}</dd></div>
          </dl>
        </details>
      </main>

      {notice && (
        <div className={`notice notice--${notice.tone}`} role="status">
          <span />
          <p>{notice.text}{notice.code && <code>{notice.code}</code>}</p>
        </div>
      )}
    </div>
  );
}
