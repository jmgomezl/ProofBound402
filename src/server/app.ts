import cors from "cors";
import express from "express";
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

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    response.status(500).json({ ok: false, code: "INTERNAL_ERROR", message });
  });

  return app;
}
