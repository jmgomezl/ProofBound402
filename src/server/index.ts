import { createApp } from "./app.js";
import { DemoEngine } from "./demo-engine.js";
import { createSettlementAdapterFromEnv } from "./live-settlement.js";

try {
  process.loadEnvFile();
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
    throw error;
  }
}

const port = Number.parseInt(process.env.PORT ?? "4402", 10);
const settlement = createSettlementAdapterFromEnv();
const app = createApp(() => new DemoEngine(settlement));

app.listen(port, () => {
  console.log(`ProofBound402 API listening on http://localhost:${port}`);
});
