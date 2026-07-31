import cors from "cors";
import express from "express";
import { parsePaymentPayload } from "@x402/core/schemas";
import type { PaymentPayload } from "@x402/core/types";
import { z } from "zod";
import { DEMO_RESOURCES } from "../shared/contracts.js";
import { DemoEngine } from "./demo-engine.js";

const issueSchema = z.object({ resource: z.enum(["basic", "premium"]).default("basic") });
const demoSessionSchema = z.string().uuid();
const MAX_DEMO_SESSIONS = 128;
const DEMO_SESSION_IDLE_MS = 60 * 60 * 1_000;

type DemoEngineFactory = () => DemoEngine;

interface DemoSession {
  engine: DemoEngine;
  lastSeenAt: number;
}

export function createApp(engineSource: DemoEngine | DemoEngineFactory = new DemoEngine()) {
  const createEngine: DemoEngineFactory = typeof engineSource === "function"
    ? engineSource
    : () => engineSource;
  const protocolEngine = createEngine();
  const demoSessions = new Map<string, DemoSession>();

  const demoEngineFor = (request: express.Request): DemoEngine => {
    const parsedSession = demoSessionSchema.safeParse(request.header("x-demo-session"));
    if (!parsedSession.success) return protocolEngine;

    const now = Date.now();
    const existing = demoSessions.get(parsedSession.data);
    if (existing) {
      existing.lastSeenAt = now;
      return existing.engine;
    }

    for (const [sessionId, session] of demoSessions) {
      if (now - session.lastSeenAt > DEMO_SESSION_IDLE_MS) demoSessions.delete(sessionId);
    }
    if (demoSessions.size >= MAX_DEMO_SESSIONS) {
      const oldestSessionId = [...demoSessions.entries()]
        .sort((left, right) => left[1].lastSeenAt - right[1].lastSeenAt)[0]?.[0];
      if (oldestSessionId) demoSessions.delete(oldestSessionId);
    }

    const session = { engine: createEngine(), lastSeenAt: now };
    demoSessions.set(parsedSession.data, session);
    return session.engine;
  };

  const app = express();
  app.disable("x-powered-by");
  app.use(cors());
  app.use(express.json({ limit: "32kb" }));

  app.get("/api/health", (_request, response) => {
    response.json({ ok: true, service: "proofbound402", mode: protocolEngine.state().mode });
  });

  app.get("/api/demo/state", (request, response) => {
    response.json(demoEngineFor(request).state());
  });

  app.post("/api/demo/reset", (request, response) => {
    response.json(demoEngineFor(request).reset());
  });

  app.post("/api/demo/unbound-attack", (request, response) => {
    response.json(demoEngineFor(request).runUnboundAttack());
  });

  app.post("/api/demo/bound-challenge", (request, response) => {
    const parsed = issueSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      response.status(400).json({ ok: false, code: "INVALID_INPUT", message: parsed.error.message });
      return;
    }
    response.json(demoEngineFor(request).issueBoundChallenge(parsed.data.resource));
  });

  app.post("/api/demo/bound-attack", (request, response) => {
    response.json(demoEngineFor(request).runBoundAttack());
  });

  app.post("/api/demo/bound-settle", async (request, response, next) => {
    try {
      response.json(await demoEngineFor(request).settleBoundRequest());
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/resources/:resource", async (request, response, next) => {
    const engine = protocolEngine;
    const parsedResource = z.enum(["basic", "premium"]).safeParse(request.params.resource);
    if (!parsedResource.success) {
      response.status(404).json({ ok: false, code: "UNKNOWN_RESOURCE", message: "Unknown resource" });
      return;
    }

    const paymentHeader = request.header("PAYMENT-SIGNATURE");
    if (!paymentHeader) {
      engine.issueBoundChallenge(parsedResource.data, request.body ?? null);
      const paymentRequired = engine.paymentRequired()!;
      const encoded = Buffer.from(JSON.stringify(paymentRequired)).toString("base64");
      response
        .status(402)
        .set("PAYMENT-REQUIRED", encoded)
        .json(paymentRequired);
      return;
    }

    try {
      const decoded = JSON.parse(Buffer.from(paymentHeader, "base64").toString("utf8"));
      const parsedPayment = parsePaymentPayload(decoded);
      if (!parsedPayment.success || parsedPayment.data.x402Version !== 2) {
        response.status(400).json({
          ok: false,
          code: "INVALID_PAYMENT_SIGNATURE",
          message: "PAYMENT-SIGNATURE must contain a valid x402 v2 payment payload",
        });
        return;
      }
      const result = await engine.settleBoundRequest(parsedPayment.data as PaymentPayload, {
        resource: parsedResource.data,
        body: request.body ?? null,
      });
      if (!result.ok) {
        response.status(402).json(result);
        return;
      }
      const paymentResponse = engine.paymentResponse()!;
      response
        .status(200)
        .set("PAYMENT-RESPONSE", Buffer.from(JSON.stringify(paymentResponse)).toString("base64"))
        .json({
          ok: true,
          resource: parsedResource.data,
          report: DEMO_RESOURCES[parsedResource.data].content,
          payment: paymentResponse,
        });
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    response.status(500).json({ ok: false, code: "INTERNAL_ERROR", message });
  });

  return app;
}
