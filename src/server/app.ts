import cors from "cors";
import express from "express";
import { parsePaymentPayload } from "@x402/core/schemas";
import type { PaymentPayload } from "@x402/core/types";
import { z } from "zod";
import { DemoEngine } from "./demo-engine.js";

const issueSchema = z.object({ resource: z.enum(["basic", "premium"]).default("basic") });

export function createApp(engine = new DemoEngine()) {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors());
  app.use(express.json({ limit: "32kb" }));

  app.get("/api/health", (_request, response) => {
    response.json({ ok: true, service: "proofbound402", mode: engine.state().mode });
  });

  app.get("/api/demo/state", (_request, response) => {
    response.json(engine.state());
  });

  app.post("/api/demo/reset", (_request, response) => {
    response.json(engine.reset());
  });

  app.post("/api/demo/unbound-attack", (_request, response) => {
    response.json(engine.runUnboundAttack());
  });

  app.post("/api/demo/bound-challenge", (request, response) => {
    const parsed = issueSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      response.status(400).json({ ok: false, code: "INVALID_INPUT", message: parsed.error.message });
      return;
    }
    response.json(engine.issueBoundChallenge(parsed.data.resource));
  });

  app.post("/api/demo/bound-attack", (_request, response) => {
    response.json(engine.runBoundAttack());
  });

  app.post("/api/demo/bound-settle", async (_request, response, next) => {
    try {
      response.json(await engine.settleBoundRequest());
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/resources/:resource", async (request, response, next) => {
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
        .json({ ok: true, resource: parsedResource.data, payment: paymentResponse });
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
