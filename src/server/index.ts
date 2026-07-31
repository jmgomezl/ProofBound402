import { createApp } from "./app.js";

const port = Number.parseInt(process.env.PORT ?? "4402", 10);
const app = createApp();

app.listen(port, () => {
  console.log(`ProofBound402 API listening on http://localhost:${port}`);
});
