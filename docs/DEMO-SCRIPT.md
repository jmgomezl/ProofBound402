# Demo video script (target 4:30, hard limit 5:00)

Setup before recording: `npm run dev` with live testnet credentials loaded, dashboard open at the top of the page showing the **LIVE** badge, demo freshly reset (circular arrow, top right). Have HashScan available — the dashboard links to it directly. Speak the bold lines; the rest are stage directions.

## 0:00 — The problem (30s)

Face the hero, don't scroll yet.

**"x402 lets an AI agent pay for a resource over HTTP. But the settlement only proves money moved — it doesn't say what that payment was allowed to unlock. ProofBound402 fixes that on Hedera: every payment carries a one-time label naming the exact request it pays for."**

Click **See it in three steps**.

## 0:30 — Show the exploit (45s)

Card 01, "Same payment opens both."

**"Here are two reports with identical price, asset, and recipient. Without a label, the server literally cannot tell them apart."**

Click **Show what goes wrong** and let the door sequence play: the paid-for report opens, then the other one **also opens**, in red.

**"Watch: the report it paid for opens — and the other one also opens. One payment, both doors. The server knew money moved — nothing more."**

## 1:15 — Block it (60s)

Card 02, "Payment opens one report."

**"Now the protected version. Before paying, the server issues a one-time label: this payment is for Market pulse, this exact request body, this payer, once, and it expires."**

Click **Create label for Market pulse**. Point at step 1's text flipping to "Done: this payment now says 'Market pulse only,' single use."

**"Let's try the same trick again — use this payment on the wrong report."**

Click **Try label on Alpha dossier**. Point at the blocked verdict.

**"Rejected, with a machine-readable reason: RESOURCE_MISMATCH. The label doesn't match the request."**

## 2:15 — Pay for real on Hedera (75s)

**"Now the honest path — and this is a real transaction on Hedera testnet."**

Click **Pay 0.01 HBAR and open**. While it settles (~10s), talk:

**"The label's SHA-256 digest is committed into the Hedera transaction memo before the payer signs. Settlement goes through the official x402 Hedera facilitator. And the server doesn't take the facilitator's word for it — it independently confirms through Mirror Node that the memo matches and the exact amount reached the exact recipient."**

When it settles, the report itself unfolds with an **UNLOCKED** stamp — point at it, then click **VIEW ON HASHSCAN** in its footer.

**"Here's the transaction on HashScan. The memo starts with pb402:v1 — that's the request binding, publicly verifiable by anyone."**

Point at the memo field on HashScan. Return to the dashboard.

## 3:30 — Technical proof (45s)

Open the **Technical proof** panel.

**"For the skeptics: the full binding digest, the one-time nonce now consumed, the x402 v2 requirement, and the consensus timestamp. Settlement success alone never authorizes delivery — the request must match the signed memo, and the nonce burns exactly once. Wrong resource, tampered body, expiry, replay: all fail closed."**

## 4:15 — Close (30s)

**"This is the oldest bug in payments — receipts replayed across products, deposits matched by amount alone — arriving on a new rail, and autonomous agents won't notice when it hits them. ProofBound402 doesn't claim a flaw in x402 — it hardens the integration pattern every resource server needs when agents pay autonomously. One payment, one exact request, publicly provable on Hedera. Repo, evidence, and verified HashScan transactions are linked below."**

---

# Submission form copy

**Project name:** ProofBound402

**One-liner:** A Hedera-native hardening layer for x402 that binds each payment to the exact HTTP request it authorizes — committed in the transaction memo, independently verified through Mirror Node.

**Description:**
When an AI agent pays per request with x402, settlement proves money moved — not what it unlocked. Two resources with identical payment terms are indistinguishable, so a payment for one can be transplanted to the other. ProofBound402 closes that gap using Hedera rails: the server issues a one-time binding (method, resource, body hash, amount, asset, recipient, payer, nonce, network, expiry), its SHA-256 digest rides in the Hedera transaction memo as `pb402:v1:<digest>`, and delivery is authorized only after Mirror Node independently confirms the memo and the exact transfer. The demo reproduces the transplant attack live, blocks it, then settles a real testnet payment end to end through the official `@x402/core` + `@x402/hedera` facilitator.

**Links:**
- Repo: https://github.com/jmgomezl/ProofBound402
- Evidence: https://github.com/jmgomezl/ProofBound402/blob/main/EVIDENCE.md
- HashScan: https://hashscan.io/testnet/transaction/0.0.9859769-1785521551-549343245
- HashScan (repeat run): https://hashscan.io/testnet/transaction/0.0.9859769-1785531587-393752447
- Demo video: (add link)
