import {
  AlertTriangle,
  ArrowRight,
  Check,
  CircleDot,
  ExternalLink,
  Fingerprint,
  FlaskConical,
  LockKeyhole,
  Play,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApiResult, DemoEvent, DemoState } from "../shared/contracts";

const EMPTY_STATE: DemoState = { mode: "simulated", events: [] };

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
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  variant?: "dark" | "signal" | "outline";
}) {
  return (
    <button className={`action action--${variant}`} disabled={disabled} onClick={onClick}>
      {icon}
      <span>{children}</span>
    </button>
  );
}

export function App() {
  const [state, setState] = useState<DemoState>(EMPTY_STATE);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    request<DemoState>("/api/demo/state").then(setState).catch((error: Error) => {
      setNotice({ tone: "error", text: error.message });
    });
  }, []);

  const run = useCallback(async (name: string, path: string, body: unknown = {}) => {
    setBusy(name);
    setNotice(null);
    try {
      const result = await request<ApiResult>(path, body);
      setState(result.state);
      setNotice({ tone: result.ok ? "ok" : "error", text: `${result.code}: ${result.message}` });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Request failed" });
    } finally {
      setBusy(null);
    }
  }, []);

  const latestDecision = useMemo(
    () => [...state.events].reverse().find((item) => item.kind.startsWith("attack.")),
    [state.events],
  );
  const challenge = state.activeChallenge;
  const paymentTerms = challenge?.paymentRequired;

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
        <div className="network">
          <span className={`network__light network__light--${state.mode}`} />
          <span>HEDERA TESTNET</span>
          <b>{state.mode === "testnet" ? "LIVE" : "SIMULATION"}</b>
        </div>
        <button
          className="icon-button"
          title="Reset attack lab"
          aria-label="Reset attack lab"
          onClick={() => run("reset", "/api/demo/reset")}
          disabled={busy !== null}
        >
          <RotateCcw size={18} />
        </button>
      </header>

      <main>
        <section className="statement">
          <div className="statement__index">PB / 01</div>
          <h1>One payment.<br />One exact request.</h1>
          <div className="statement__proof">
            <Fingerprint size={24} />
            <span>HTTP intent</span>
            <ArrowRight size={16} />
            <span>Hedera memo</span>
            <ArrowRight size={16} />
            <span>HCS receipt</span>
          </div>
        </section>

        <section className="lab-grid">
          <div className="scenario scenario--unsafe">
            <div className="scenario__header">
              <span className="eyebrow">CONTROL / UNBOUND</span>
              <span className="risk"><AlertTriangle size={14} /> RESOURCE BLIND</span>
            </div>
            <h2>Settlement-only authorization</h2>
            <div className="route-stack">
              <div className="route"><span>01</span><code>POST /reports/market-pulse</code><b>{paymentTerms?.amount ?? "1000000"} ATOMIC</b></div>
              <div className="route"><span>02</span><code>POST /reports/alpha-dossier</code><b>{paymentTerms?.amount ?? "1000000"} ATOMIC</b></div>
            </div>
            <div className="scenario__flow">
              <span>PAY 01</span><ArrowRight size={15} /><span>REDEEM 02</span><ArrowRight size={15} /><b>DELIVER</b>
            </div>
            <ActionButton
              icon={<Play size={16} fill="currentColor" />}
              onClick={() => run("unbound", "/api/demo/unbound-attack")}
              disabled={busy !== null}
            >
              {busy === "unbound" ? "Running..." : "Run transplant"}
            </ActionButton>
          </div>

          <div className="scenario scenario--bound">
            <div className="scenario__header">
              <span className="eyebrow">PROOFBOUND / V1</span>
              <span className="guard"><LockKeyhole size={14} /> REQUEST LOCKED</span>
            </div>
            <h2>Intent-bound authorization</h2>
            <div className="binding-strip">
              <span>METHOD</span><span>PATH</span><span>BODY</span><span>TERMS</span><span>NONCE</span><span>TTL</span>
            </div>
            <div className="memo-line">
              <span>MEMO</span>
              <code title={challenge?.memo}>{challenge ? shorten(challenge.memo, 22, 12) : "pb402:v1:<sha256>"}</code>
            </div>
            <div className="button-row">
              <ActionButton
                icon={<Fingerprint size={16} />}
                variant="outline"
                onClick={() => run("issue", "/api/demo/bound-challenge", { resource: "basic" })}
                disabled={busy !== null}
              >
                {busy === "issue" ? "Issuing..." : "Issue binding"}
              </ActionButton>
              <ActionButton
                icon={<ShieldCheck size={16} />}
                variant="signal"
                onClick={() => run("bound", "/api/demo/bound-attack")}
                disabled={busy !== null || !challenge || challenge.status === "consumed"}
              >
                {busy === "bound" ? "Verifying..." : "Attempt transplant"}
              </ActionButton>
            </div>
            <ActionButton
              icon={<Check size={16} />}
              onClick={() => run("settle", "/api/demo/bound-settle")}
              disabled={busy !== null || !challenge || challenge.status === "consumed"}
            >
              {busy === "settle" ? "Settling..." : "Settle exact request"}
            </ActionButton>
          </div>
        </section>

        <section className="evidence-grid">
          <div className="trace-panel">
            <div className="panel-heading">
              <div><FlaskConical size={17} /><h2>Execution trace</h2></div>
              <span>{state.events.length.toString().padStart(2, "0")} EVENTS</span>
            </div>
            <div className="timeline">
              {state.events.length === 0 ? (
                <div className="empty-trace"><CircleDot size={18} /><span>NO EXECUTION DATA</span></div>
              ) : (
                state.events.map((item, index) => (
                  <article className={`trace trace--${item.tone}`} key={item.id}>
                    <div className="trace__rail"><EventIcon event={item} /><span /></div>
                    <div className="trace__body">
                      <div className="trace__meta"><span>{String(index + 1).padStart(2, "0")}</span><time>{new Date(item.at).toLocaleTimeString([], { hour12: false })}</time></div>
                      <h3>{item.title}</h3>
                      <p>{item.detail}</p>
                      {item.proof && (
                        <div className="proof-row">
                          {Object.entries(item.proof).slice(0, 3).map(([key, value]) => (
                            <span key={key}><b>{key}</b><code title={value}>{shorten(value)}</code></span>
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>

          <aside className="inspector">
            <div className="panel-heading">
              <div><Fingerprint size={17} /><h2>Proof inspector</h2></div>
              <span>{challenge?.status.toUpperCase() ?? "EMPTY"}</span>
            </div>
            <dl>
              <div><dt>Binding digest</dt><dd title={challenge?.digest}>{challenge ? shorten(challenge.digest, 18, 14) : "-"}</dd></div>
              <div><dt>x402 requirement</dt><dd>{paymentTerms ? `V${paymentTerms.x402Version} / ${paymentTerms.scheme.toUpperCase()}` : "-"}</dd></div>
              <div><dt>Fee payer</dt><dd>{paymentTerms?.feePayer ?? "-"}</dd></div>
              <div><dt>Nonce</dt><dd title={challenge?.nonce}>{challenge ? shorten(challenge.nonce, 14, 8) : "-"}</dd></div>
              <div><dt>Expires</dt><dd>{challenge ? new Date(challenge.expiresAt).toLocaleTimeString([], { hour12: false }) : "-"}</dd></div>
              <div><dt>Decision</dt><dd className={latestDecision?.tone === "danger" ? "text-danger" : "text-success"}>{latestDecision?.proof?.decision ?? "-"}</dd></div>
              <div><dt>Invariant</dt><dd>{latestDecision?.proof?.invariant ?? "-"}</dd></div>
            </dl>

            <div className="chain-proof">
              <span className="eyebrow">PUBLIC EVIDENCE</span>
              <div className="chain-proof__status">
                <span className={state.evidence ? "is-ready" : ""}><Check size={13} /></span>
                <p><b>Transaction</b><code>{state.evidence ? shorten(state.evidence.transactionId) : "Pending"}</code></p>
                {state.evidence?.hashscanTransactionUrl && <a href={state.evidence.hashscanTransactionUrl} target="_blank" rel="noreferrer" title="Open transaction in HashScan"><ExternalLink size={15} /></a>}
              </div>
              <div className="chain-proof__status">
                <span className={state.evidence?.hcsTopicId ? "is-ready" : ""}><Check size={13} /></span>
                <p><b>HCS receipt</b><code>{state.evidence?.hcsTopicId ? `${state.evidence.hcsTopicId} / ${state.evidence.hcsSequenceNumber}` : "Pending / issue #2"}</code></p>
                {state.evidence?.hashscanTopicUrl && <a href={state.evidence.hashscanTopicUrl} target="_blank" rel="noreferrer" title="Open topic in HashScan"><ExternalLink size={15} /></a>}
              </div>
              {state.mode === "simulated" && <p className="simulation-note">SIMULATED IDs / CONNECT TESTNET CREDENTIALS FOR SUBMISSION EVIDENCE</p>}
            </div>
          </aside>
        </section>
      </main>

      {notice && <div className={`notice notice--${notice.tone}`} role="status"><span />{notice.text}</div>}
    </div>
  );
}
