import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  CircleDot,
  ExternalLink,
  Fingerprint,
  FlaskConical,
  LockKeyhole,
  Play,
  Radio,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  Tag,
  WalletCards,
  X,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  DEMO_RESOURCES,
  type ApiResult,
  type DemoEvent,
  type DemoState,
  type ResourceId,
} from "../shared/contracts";

const EMPTY_STATE: DemoState = { mode: "simulated", events: [] };

const FRIENDLY_RESULTS: Record<string, string> = {
  CHALLENGE_ISSUED: "One-time payment label created.",
  RESOURCE_MISMATCH: "Blocked. This payment is labeled for a different report.",
  DELIVERED: "Payment confirmed. The right report is open.",
  UNBOUND_ATTACK_ACCEPTED: "Problem confirmed. The same payment opened the wrong report.",
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

function friendlyEvent(event: DemoEvent): { title: string; detail: string } {
  if (event.kind === "payment.created") {
    return { title: "Payment accepted without a label", detail: "The server knows money moved, but not which report it should open." };
  }
  if (event.kind === "attack.accepted") {
    return { title: "Wrong report opened", detail: "The unlabeled payment looked valid because both reports have the same price." };
  }
  if (event.kind === "challenge.issued") {
    return { title: event.title.replace("Binding issued", "One-time label created"), detail: "The payment now names one report and can be used only once before it expires." };
  }
  if (event.kind === "attack.blocked") {
    return { title: "Wrong report blocked", detail: "The report being requested does not match the label attached to this payment." };
  }
  if (event.kind === "settlement.confirmed") {
    return { title: "Payment confirmed publicly", detail: "Hedera confirms the payment and its one-time label together." };
  }
  if (event.kind === "request.delivered") {
    return { title: event.title.replace("authorized", "opened"), detail: "The requested report matches the payment label, so access is granted." };
  }
  return { title: event.title, detail: event.detail };
}

function FlowStrip({
  steps,
  tone,
}: {
  steps: { icon: React.ReactNode; label: string }[];
  tone: "danger" | "success";
}) {
  return (
    <div className={`flow-strip flow-strip--${tone}`} aria-hidden="true">
      <span className="flow-strip__title">BEHIND THE SCENES</span>
      {steps.map((step, index) => (
        <Fragment key={index}>
          <span className="flow-strip__node" style={{ animationDelay: `${0.15 + index * 0.55}s` }}>
            {step.icon}
            <small>{step.label}</small>
          </span>
        </Fragment>
      ))}
    </div>
  );
}

function ActionButton({
  children,
  icon,
  disabled,
  onClick,
  variant = "dark",
  testId,
  attention = false,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  variant?: "dark" | "signal" | "outline";
  testId?: string;
  attention?: boolean;
}) {
  return (
    <button
      className={`action action--${variant}${attention ? " action--attention" : ""}`}
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

function DemoMilestone({
  number,
  title,
  detail,
  state,
  targetId,
  onJump,
}: {
  number: number;
  title: string;
  detail: string;
  state: "waiting" | "active" | "done";
  targetId: string;
  onJump: (targetId: string) => void;
}) {
  return (
    <button
      type="button"
      className={`demo-milestone demo-milestone--${state}`}
      title="Jump to this step"
      onClick={() => onJump(targetId)}
    >
      <span>{state === "done" ? <Check size={14} /> : number}</span>
      <span className="demo-milestone__copy"><b>{title}</b><small>{detail}</small></span>
    </button>
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
  const [flashCard, setFlashCard] = useState<string | null>(null);

  const jumpTo = useCallback((targetId: string) => {
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlashCard(null);
    requestAnimationFrame(() => setFlashCard(targetId));
  }, []);

  useEffect(() => {
    if (!flashCard) return;
    const timer = setTimeout(() => setFlashCard(null), 1_400);
    return () => clearTimeout(timer);
  }, [flashCard]);

  useEffect(() => {
    request<DemoState>("/api/demo/state").then(setState).catch((error: Error) => {
      setNotice({ tone: "error", text: error.message });
    });
  }, []);

  useEffect(() => {
    if (state.activeChallenge) setSelectedResource(state.activeChallenge.resource);
  }, [state.activeChallenge?.id, state.activeChallenge?.resource]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6_500);
    return () => clearTimeout(timer);
  }, [notice]);

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
  const riskExposed = state.events.some((event) => event.kind === "attack.accepted");
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

  const flowHint = delivered
    ? "Done. The public record is below."
    : !riskExposed
      ? "Start here: show the problem in card 01."
      : guidedStep === 0
        ? "Next: create the payment label in card 02."
        : guidedStep === 1
          ? "Next: try the label on the wrong report."
          : state.mode === "testnet"
            ? "Next: pay and open the right report."
            : "Next: simulate the payment and open the report.";

  const nextAction = guidedStep === 0
    ? `Create label for ${selected.label}`
    : guidedStep === 1
      ? `Try label on ${alternate.label}`
      : guidedStep === 2
        ? `${state.mode === "testnet" ? `Pay ${price} and open` : "Simulate payment and open"}`
        : "Report open";

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
            <span className="eyebrow">ONE PAYMENT / ONE PERMISSION</span>
            <h1>ProofBound402</h1>
            <p><strong>Pay once. Open one thing.</strong><span>When an AI agent pays per request, an unlabeled payment can open the wrong thing. Here every payment gets a one-time label saying exactly what it can open.</span></p>
            <button
              type="button"
              className="action action--dark intro__cta"
              onClick={() => jumpTo("scenario-unbound")}
            >
              <Play size={16} fill="currentColor" />
              <span>See it in three steps</span>
            </button>
          </div>
        </section>

        <section className="simple-model" aria-labelledby="model-title">
          <div className="simple-model__heading">
            <div>
              <span className="eyebrow">THE WHOLE IDEA</span>
              <h2 id="model-title">The payment says what it is for</h2>
            </div>
            <p>For this purchase, the label says: “{selected.label} only.”</p>
          </div>
          <div className="simple-model__flow">
            <div className="simple-purchase">
              <WalletCards size={22} />
              <span><small>YOU PAY FOR</small><b>{selected.label}</b><code>{price}</code></span>
            </div>
            <ArrowRight className="simple-model__arrow" size={21} />
            <div className={`payment-label ${challenge ? "payment-label--ready" : ""}`}>
              <Tag size={23} />
              <span><small>ONE-TIME PAYMENT LABEL</small><b>Only for {selected.label}</b><em>{challenge ? "READY" : "PREVIEW"}</em></span>
            </div>
            <ArrowRight className="simple-model__arrow" size={21} />
            <div className="simple-outcomes" aria-label="What the payment can open">
              <div className="simple-outcome simple-outcome--allow">
                <Check size={17} />
                <span><small>RIGHT REPORT</small><b>{selected.label}</b></span>
                <strong>OPEN</strong>
              </div>
              <div className="simple-outcome simple-outcome--deny">
                <X size={17} />
                <span><small>WRONG REPORT</small><b>{alternate.label}</b></span>
                <strong>BLOCK</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="demo-rail" aria-label="Demo progress">
          <div className="demo-rail__label"><span className="eyebrow">SEE IT WORK</span><b aria-live="polite">{flowHint}</b></div>
          <div className="demo-rail__steps">
            <DemoMilestone
              number={1}
              title="Show the problem"
              detail="Wrong report opens"
              state={riskExposed ? "done" : "active"}
              targetId="scenario-unbound"
              onJump={jumpTo}
            />
            <ArrowRight size={15} />
            <DemoMilestone
              number={2}
              title="Block the wrong report"
              detail="Label does not match"
              state={reuseBlocked ? "done" : riskExposed ? "active" : "waiting"}
              targetId="scenario-bound"
              onJump={jumpTo}
            />
            <ArrowRight size={15} />
            <DemoMilestone
              number={3}
              title="Confirm the payment"
              detail="Public record"
              state={delivered ? "done" : reuseBlocked ? "active" : "waiting"}
              targetId="scenario-bound"
              onJump={jumpTo}
            />
          </div>
        </section>

        <section className="comparison" aria-labelledby="comparison-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">THE DIFFERENCE</span>
              <h2 id="comparison-title">Can one payment open the wrong report?</h2>
            </div>
            <p>Without a label they look identical. With a label, only the right report opens.</p>
          </div>

          <div className="comparison-grid">
            <article className={`scenario scenario--unsafe ${flashCard === "scenario-unbound" ? "scenario--flash" : ""}`} id="scenario-unbound">
              <div className="scenario__header">
                <span className="scenario__number">STEP 1 · START HERE</span>
                <span className="risk"><AlertTriangle size={14} /> WITHOUT A LABEL</span>
              </div>
              <h3>Same payment opens both</h3>
              <p className="scenario__lead">Without a label, two reports with the same price look identical.</p>
              <div className="receipt-compare">
                <div><span>PAID FOR</span><b>Market pulse</b><code>{price}</code></div>
                <ArrowRight size={18} />
                <div className="receipt-compare__wrong"><span>UNLOCKS</span><b>Alpha dossier</b><code>SAME TERMS</code></div>
              </div>
              <div className={`outcome outcome--danger ${riskExposed ? "outcome--revealed" : ""}`} aria-live="polite">
                <AlertTriangle size={17} />
                <span>
                  <b>{riskExposed ? "Reuse succeeded: wrong report delivered" : "Can the payment unlock the wrong report?"}</b>
                  <small>{riskExposed ? "The payment did not say which report it was for." : "Try the first payment on the second report."}</small>
                </span>
              </div>
              {riskExposed && (
                <FlowStrip
                  key={`unbound-${state.events.filter((item) => item.kind === "attack.accepted").length}`}
                  tone="danger"
                  steps={[
                    { icon: <WalletCards size={15} />, label: "PAYMENT ARRIVES" },
                    { icon: <ReceiptText size={15} />, label: "SERVER CHECKS PRICE ONLY" },
                    { icon: <X size={15} />, label: "REQUEST NEVER CHECKED" },
                    { icon: <AlertTriangle size={15} />, label: "WRONG REPORT OPENS" },
                  ]}
                />
              )}
              <div className="scenario__actions">
                <ActionButton
                  icon={<Play size={16} fill="currentColor" />}
                  variant={riskExposed ? "outline" : "dark"}
                  onClick={() => run("unbound", "/api/demo/unbound-attack")}
                  disabled={busy !== null}
                  testId="show-risk"
                  attention={!riskExposed}
                >
                  {busy === "unbound" ? "Checking..." : riskExposed ? "Show it again" : "Show what goes wrong"}
                </ActionButton>
                {riskExposed && !delivered && (
                  <ActionButton
                    icon={<ArrowRight size={16} />}
                    variant="dark"
                    onClick={() => jumpTo("scenario-bound")}
                    testId="goto-protected"
                  >
                    Next: block it with a label
                  </ActionButton>
                )}
              </div>
            </article>

            <article className={`scenario scenario--bound ${flashCard === "scenario-bound" ? "scenario--flash" : ""}`} id="scenario-bound">
              <div className="scenario__header">
                <span className="scenario__number">STEPS 2–3 · THE FIX</span>
                <span className="guard"><LockKeyhole size={14} /> ONE-TIME LABEL</span>
              </div>
              <h3>Payment opens one report</h3>
              <p className="scenario__lead">The payment label names the report it is allowed to open.</p>

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
                  title="Create a one-time label"
                  detail={guidedStep === 0
                    ? `Label this payment “${selected.label} only.”`
                    : `Done: this payment now says “${selected.label} only,” single use.`}
                  state={guidedStep === 0 ? "active" : "done"}
                />
                <ProgressStep
                  number={2}
                  title="Try the wrong report"
                  detail={guidedStep < 2
                    ? `Use the label on ${alternate.label}.`
                    : `Done: ${alternate.label} refused this label — wrong report.`}
                  state={guidedStep < 1 ? "waiting" : guidedStep === 1 ? "active" : "done"}
                />
                <ProgressStep
                  number={3}
                  title="Open the right report"
                  detail={guidedStep < 3
                    ? (state.mode === "testnet" ? `Pay ${price} on the public test network.` : "Check the right report in demo mode.")
                    : (state.mode === "testnet"
                      ? `Done: ${price} settled on Hedera and Mirror Node confirmed it.`
                      : "Done: simulated payment confirmed and recorded.")}
                  state={guidedStep < 2 ? "waiting" : guidedStep === 2 ? "active" : "done"}
                />
              </ol>

              <div className="guided-action">
                {challenge && (
                  <div className={`protected-verdict ${reuseBlocked || delivered ? "protected-verdict--confirmed" : ""}`} aria-live="polite">
                    {reuseBlocked || delivered ? <ShieldCheck size={18} /> : <Fingerprint size={18} />}
                    <span>
                      <b>{delivered ? "Payment confirmed" : reuseBlocked ? "Wrong report blocked" : "Payment label ready"}</b>
                      <small>{delivered
                        ? "The right report is open and the payment has a public record."
                        : reuseBlocked
                          ? `This payment says “${selected.label} only,” so ${alternate.label} stays closed.`
                          : `This payment can open ${selected.label} once.`}</small>
                    </span>
                  </div>
                )}
                {(reuseBlocked || delivered) && (
                  <FlowStrip
                    key={`bound-${challenge?.id ?? "none"}-${delivered ? "delivered" : "blocked"}`}
                    tone="success"
                    steps={delivered
                      ? [
                          { icon: <Tag size={15} />, label: "LABEL MATCHES REQUEST" },
                          { icon: <Radio size={15} />, label: "HBAR + LABEL ON HEDERA" },
                          { icon: <Fingerprint size={15} />, label: "MIRROR NODE CONFIRMS" },
                          { icon: <Check size={15} />, label: "REPORT OPENS ONCE" },
                        ]
                      : [
                          { icon: <Tag size={15} />, label: `LABEL SAYS ${selected.label.toUpperCase()}` },
                          { icon: <Fingerprint size={15} />, label: "SERVER RECOMPUTES FROM REQUEST" },
                          { icon: <X size={15} />, label: "LABEL DOES NOT MATCH" },
                          { icon: <ShieldCheck size={15} />, label: "DELIVERY BLOCKED" },
                        ]}
                  />
                )}
                {delivered && (
                  <div className="report-doc" aria-label={`${selected.label} report, unlocked`}>
                    <div className="report-doc__head">
                      <b>{selected.label}</b>
                      <span>UNLOCKED</span>
                    </div>
                    <ul>
                      {DEMO_RESOURCES[selectedResource].content.map((line, index) => (
                        <li key={index} style={{ animationDelay: `${0.3 + index * 0.2}s` }}>{line}</li>
                      ))}
                    </ul>
                    <footer>
                      <span>PAID {price}</span>
                      {state.evidence && <code title={state.evidence.transactionId}>{shorten(state.evidence.transactionId, 14, 8)}</code>}
                      {state.evidence?.hashscanTransactionUrl && (
                        <a href={state.evidence.hashscanTransactionUrl} target="_blank" rel="noreferrer">
                          VIEW ON HASHSCAN <ExternalLink size={11} />
                        </a>
                      )}
                    </footer>
                  </div>
                )}
                {guidedStep === 2 && state.mode === "testnet" && (
                <p><Radio size={13} /> This makes a real payment using test currency.</p>
                )}
                {guidedStep === 3 ? (
                  <ActionButton
                    icon={<RotateCcw size={16} />}
                    variant="signal"
                    onClick={() => run("reset", "/api/demo/reset")}
                    disabled={busy !== null}
                    testId="restart-demo"
                  >
                    {busy === "reset" ? "Resetting..." : "Start over with a new label"}
                  </ActionButton>
                ) : (
                  <ActionButton
                    icon={guidedStep === 0
                      ? <Fingerprint size={16} />
                      : guidedStep === 1
                        ? <ShieldCheck size={16} />
                        : <Check size={16} />}
                    variant="signal"
                    onClick={runNextStep}
                    disabled={busy !== null}
                    testId="next-protected-step"
                    attention={riskExposed}
                  >
                    {busy === "issue"
                      ? "Protecting..."
                      : busy === "bound"
                        ? "Testing reuse..."
                        : busy === "settle"
                          ? "Verifying payment..."
                          : nextAction}
                  </ActionButton>
                )}
              </div>
            </article>
          </div>
        </section>

        <section className="result-band" aria-live="polite">
          <div className={`result-band__mark ${delivered || reuseBlocked ? "is-success" : riskExposed ? "is-danger" : ""}`}>
            {delivered || reuseBlocked ? <ShieldCheck size={26} /> : riskExposed ? <AlertTriangle size={26} /> : <CircleDot size={26} />}
          </div>
          <div>
            <span className="eyebrow">DEMO VERDICT</span>
            <h2>{delivered ? `${selected.label} is open` : reuseBlocked ? "Wrong report stayed closed" : challenge ? "One-time payment label ready" : riskExposed ? "Unlabeled payment opened the wrong report" : "Ready to show the problem"}</h2>
            <p>{delivered
              ? "The payment label matched the report and cannot be used again."
              : reuseBlocked
                ? `${alternate.label} was blocked because the payment label names ${selected.label}.`
                : challenge
                  ? `The payment now says “${selected.label} only” and can be used once.`
                  : riskExposed
                    ? "The payment proved money moved, but it did not say what it was allowed to open."
                    : "Start by using one unlabeled payment on two same-price reports."}</p>
          </div>
          <span className={`decision-pill ${riskExposed && !challenge ? "decision-pill--danger" : ""}`}>
            {delivered ? "DELIVERED" : reuseBlocked ? "BLOCKED" : challenge ? "PROTECTED" : riskExposed ? "GAP EXPOSED" : "READY"}
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
                state.events.map((item, index) => {
                  const copy = friendlyEvent(item);
                  return (
                    <article className={`trace trace--${item.tone}`} key={item.id}>
                      <div className="trace__rail"><EventIcon event={item} /><span /></div>
                      <div className="trace__body">
                        <div className="trace__meta"><span>{String(index + 1).padStart(2, "0")}</span><time>{new Date(item.at).toLocaleTimeString([], { hour12: false })}</time></div>
                        <h3>{copy.title}</h3>
                        <p>{copy.detail}</p>
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
                  );
                })
              )}
            </div>
          </div>

          <aside className="public-proof">
            <div className="panel-heading">
              <div><ReceiptText size={17} /><h2>Public evidence</h2></div>
              <span>{state.evidence ? "VERIFIED" : challenge ? "BOUND" : "READY"}</span>
            </div>
            <div className="public-proof__body">
              <div className="chain-proof__status">
                <span className={challenge ? "is-ready" : ""}><Check size={13} /></span>
                <p><b>One-time payment label</b><code>{challenge ? "Ready for the selected report" : "Created before payment"}</code></p>
              </div>
              <div className="chain-proof__status">
                <span className={state.evidence ? "is-ready" : ""}><Check size={13} /></span>
                <p><b>Public payment record</b><code>{state.evidence ? shorten(state.evidence.transactionId, 18, 12) : "Awaiting payment"}</code></p>
                {state.evidence?.hashscanTransactionUrl && <a href={state.evidence.hashscanTransactionUrl} target="_blank" rel="noreferrer" title="Open transaction in HashScan"><ExternalLink size={15} /></a>}
              </div>
              {state.evidence?.hcsTopicId && (
                <div className="chain-proof__status">
                  <span className="is-ready"><Check size={13} /></span>
                  <p><b>HCS delivery receipt</b><code>{`${state.evidence.hcsTopicId} / ${state.evidence.hcsSequenceNumber}`}</code></p>
                  {state.evidence.hashscanTopicUrl && <a href={state.evidence.hashscanTopicUrl} target="_blank" rel="noreferrer" title="Open topic in HashScan"><ExternalLink size={15} /></a>}
                </div>
              )}
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
            <div><dt>Hedera transaction</dt><dd>{state.evidence?.transactionId ?? "-"}</dd></div>
            <div><dt>Consensus timestamp</dt><dd>{state.evidence?.consensusTimestamp ?? "-"}</dd></div>
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
