# Demo narration script (~3 minutes)

Voice: Titan — Deep, Bold, and Powerful (`dtSEyYGNJqjrtBArPCVZ`), model `eleven_v3`.
Audio: `docs/demo-narration.mp3`. Section timings for editing: `docs/demo-narration-timings.txt`.

Five sections, written so each one maps to a stretch of screen recording.

---

## 1 — The blind spot

Every AI agent that pays for something online has the same blind spot.

With x402, an agent pays over HTTP and gets its data back. The payment settles. Money moved. But settlement only proves that money moved. It never says what that money was allowed to unlock.

Watch what that costs you.

## 2 — The exploit

Here are two reports. Same price. Same asset. Same recipient. Identical payment terms, but very different value. To the server, they are indistinguishable.

I pay for the first one, a basic market summary. The server confirms the payment, and opens it.

Then I take that exact same payment, and I ask for the second report. The protected research dossier. And it opens too.

One payment. Both doors. The server saw a valid transfer, and had no idea which request it belonged to.

## 3 — The fix

Now the fix.

Before any money moves, ProofBound402 issues a one-time label. It commits the method, the exact resource, a hash of the request body, the amount, the recipient, the payer, a nonce, and an expiry, into a single SHA-256 digest.

That digest goes into the Hedera transaction memo. Signed by the payer. Public. Permanent.

Same attack, one more time. I take the labeled payment, and I ask for the wrong report. Rejected. Resource mismatch. The label names one request, and this is not it.

## 4 — Real settlement on Hedera

And now the honest path. A real transaction, on Hedera testnet, right now.

The payment settles through the official x402 Hedera facilitator. But settlement alone still authorizes nothing. The server independently queries Mirror Node, and confirms three things. The memo on chain matches the label it issued. The exact amount left the payer. The exact amount reached the recipient.

Only then does the report open. And the nonce burns, so that payment can never be used again.

Here it is on HashScan. The memo, p b four zero two, version one, is the request binding. Anyone can verify it. No trust required.

## 5 — Why it matters

This is the oldest bug in payments. Receipts replayed across products. Deposits matched by amount alone. Arriving on a brand new rail.

A human notices when the wrong thing opens. An autonomous agent, making hundreds of paid calls a minute, never will.

ProofBound402 does not claim a flaw in x402. It hardens the pattern every resource server needs, the moment agents start paying for themselves.

One payment. One exact request. Publicly provable, on Hedera.
