import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";

describe("attack lab API", () => {
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

    const protectedAttempt = await request(app).post("/api/demo/bound-attack").send();
    expect(protectedAttempt.body).toMatchObject({ ok: true, code: "RESOURCE_MISMATCH" });
    expect(protectedAttempt.body.state.activeChallenge.status).toBe("issued");

    const delivered = await request(app).post("/api/demo/bound-settle").send();
    expect(delivered.body).toMatchObject({ ok: true, code: "DELIVERED" });
    expect(delivered.body.state.activeChallenge.status).toBe("consumed");
    expect(delivered.body.state.evidence.memo).toBe(challenge.body.state.activeChallenge.memo);
    expect(delivered.body.state.mode).toBe("simulated");
  });
});
