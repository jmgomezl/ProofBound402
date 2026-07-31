import request from "supertest";
import { describe, expect, it } from "vitest";
import type { BindingChallenge } from "../protocol/types.js";
import { DEMO_RESOURCES } from "../shared/contracts.js";
import { createApp } from "./app.js";
import { DemoEngine } from "./demo-engine.js";
import { SimulatedSettlementAdapter } from "./settlement.js";

describe("attack lab API", () => {
  it("isolates interactive demo state by browser session", async () => {
    const app = createApp(() => new DemoEngine());
    const sessionA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const sessionB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

    await request(app)
      .post("/api/demo/unbound-attack")
      .set("x-demo-session", sessionA)
      .send();

    const sameSession = await request(app)
      .get("/api/demo/state")
      .set("x-demo-session", sessionA);
    const newSession = await request(app)
      .get("/api/demo/state")
      .set("x-demo-session", sessionB);

    expect(sameSession.body.events).toHaveLength(2);
    expect(sameSession.body.events.at(-1)).toMatchObject({ kind: "attack.accepted" });
    expect(newSession.body).toMatchObject({ mode: "simulated", events: [] });
  });

  it("shows the exploit, blocks the transplant, and delivers the bound request", async () => {
    const app = createApp();

    const vulnerable = await request(app).post("/api/demo/unbound-attack").send();
    expect(vulnerable.status).toBe(200);
    expect(vulnerable.body).toMatchObject({ ok: true, code: "UNBOUND_ATTACK_ACCEPTED" });
    expect(vulnerable.body.state.events.at(-1)).toMatchObject({ kind: "attack.accepted" });

    const challenge = await request(app)
      .post("/api/demo/bound-challenge")
      .send({ resource: "basic" });
    expect(challenge.body.state.activeChallenge.memo).toMatch(/^pb402:v1:/);
    expect(challenge.body.state.deliveredReport).toBeUndefined();

    const protectedAttempt = await request(app).post("/api/demo/bound-attack").send();
    expect(protectedAttempt.body).toMatchObject({ ok: true, code: "RESOURCE_MISMATCH" });
    expect(protectedAttempt.body.state.activeChallenge.status).toBe("issued");
    expect(protectedAttempt.body.state.deliveredReport).toBeUndefined();

    const delivered = await request(app).post("/api/demo/bound-settle").send();
    expect(delivered.body).toMatchObject({ ok: true, code: "DELIVERED" });
    expect(delivered.body.state.activeChallenge.status).toBe("consumed");
    expect(delivered.body.state.evidence.memo).toBe(challenge.body.state.activeChallenge.memo);
    expect(delivered.body.state.deliveredReport).toEqual({
      resource: "basic",
      content: DEMO_RESOURCES.basic.content,
    });
    expect(delivered.body.state.mode).toBe("simulated");

    const nextChallenge = await request(app)
      .post("/api/demo/bound-challenge")
      .send({ resource: "premium" });
    expect(nextChallenge.body.state.deliveredReport).toBeUndefined();

    const reset = await request(app).post("/api/demo/reset").send();
    expect(reset.body.state.deliveredReport).toBeUndefined();
  });

  it("emits an x402 v2 challenge and binds the paid retry to the actual HTTP request", async () => {
    const app = createApp();
    const body = { query: "hbar liquidity" };
    const unpaid = await request(app).post("/api/resources/basic").send(body);

    expect(unpaid.status).toBe(402);
    expect(unpaid.headers["payment-required"]).toBeTruthy();
    expect(unpaid.body).toMatchObject({
      x402Version: 2,
      accepts: [{ scheme: "exact", network: "hedera:testnet" }],
    });
    expect(unpaid.body.accepts[0].extra.proofBound402.memo).toMatch(/^pb402:v1:/);

    const paymentPayload = {
      x402Version: 2,
      accepted: unpaid.body.accepts[0],
      payload: { transaction: "simulated-payment" },
    };
    const paymentHeader = Buffer.from(JSON.stringify(paymentPayload)).toString("base64");
    const transplanted = await request(app)
      .post("/api/resources/premium")
      .set("PAYMENT-SIGNATURE", paymentHeader)
      .send(body);
    expect(transplanted.status).toBe(402);
    expect(transplanted.body).toMatchObject({ ok: false, code: "RESOURCE_MISMATCH" });

    const delivered = await request(app)
      .post("/api/resources/basic")
      .set("PAYMENT-SIGNATURE", paymentHeader)
      .send(body);
    expect(delivered.status).toBe(200);
    expect(delivered.headers["payment-response"]).toBeTruthy();
    expect(delivered.body.report).toEqual(DEMO_RESOURCES.basic.content);
    expect(delivered.body.payment).toMatchObject({ success: true, network: "hedera:testnet" });
  });

  it("releases the nonce reservation when settlement fails", async () => {
    class FailingSettlementAdapter extends SimulatedSettlementAdapter {
      override async settle(_challenge: BindingChallenge): Promise<never> {
        throw new Error("settlement unavailable");
      }
    }

    const app = createApp(new DemoEngine(new FailingSettlementAdapter()));
    await request(app).post("/api/demo/bound-challenge").send({ resource: "basic" });
    const failed = await request(app).post("/api/demo/bound-settle").send();
    expect(failed.status).toBe(500);

    const state = await request(app).get("/api/demo/state");
    expect(state.body.activeChallenge.status).toBe("issued");
  });
});
