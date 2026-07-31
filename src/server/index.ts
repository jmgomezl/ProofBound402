import { createApp } from "./app.js";
import { DemoEngine } from "./demo-engine.js";
import { createSettlementAdapterFromEnv } from "./live-settlement.js";

const port = Number.parseInt(process.env.PORT ?? "4402", 10);
const app = createApp(new DemoEngine(createSettlementAdapterFromEnv()));

app.listen(port, () => {
  console.log(`ProofBound402 API listening on http://localhost:${port}`);
});
