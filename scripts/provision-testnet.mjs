import fs from "node:fs";
import {
  AccountCreateTransaction,
  AccountId,
  Client,
  Hbar,
  PrivateKey,
} from "@hiero-ledger/sdk";

const ENV_PATH = new URL("../.env", import.meta.url);
const REQUIRED_ROLES = [
  "HEDERA_PAYER_ACCOUNT_ID",
  "HEDERA_PAYER_PRIVATE_KEY",
  "HEDERA_FACILITATOR_ACCOUNT_ID",
  "HEDERA_FACILITATOR_PRIVATE_KEY",
  "PROOFBOUND_PAY_TO",
];

function parseEnv(text) {
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
        return [line.slice(0, separator).trim(), value];
      }),
  );
}

function parseEcdsaKey(value) {
  const normalized = value.startsWith("0x") ? value : `0x${value}`;
  return PrivateKey.fromStringECDSA(normalized);
}

async function resolveAccountId(privateKey) {
  const alias = `0x${privateKey.publicKey.toEvmAddress()}`;
  const response = await fetch(
    `https://testnet.mirrornode.hedera.com/api/v1/accounts/${alias}`,
  );
  if (!response.ok) {
    throw new Error(`Could not resolve bootstrap account through Mirror Node (${response.status})`);
  }
  const account = await response.json();
  if (!account.account || account.deleted) {
    throw new Error("Bootstrap key does not resolve to an active Hedera testnet account");
  }
  return account.account;
}

async function createAccount(client, initialHbar) {
  const privateKey = PrivateKey.generateECDSA();
  const response = await new AccountCreateTransaction()
    .setKeyWithoutAlias(privateKey.publicKey)
    .setInitialBalance(new Hbar(initialHbar))
    .execute(client);
  const receipt = await response.getReceipt(client);
  if (!receipt.accountId) {
    throw new Error("Hedera did not return the created account ID");
  }
  return {
    accountId: receipt.accountId.toString(),
    privateKey: `0x${privateKey.toStringRaw()}`,
    transactionId: response.transactionId.toString(),
  };
}

function updateEnv(original, values) {
  const existingKeys = new Set();
  const lines = original.split(/\r?\n/).map((line) => {
    const separator = line.indexOf("=");
    if (separator < 0 || line.trim().startsWith("#")) return line;
    const key = line.slice(0, separator).trim();
    if (!(key in values)) return line;
    existingKeys.add(key);
    return `${key}=${values[key]}`;
  });

  const additions = Object.entries(values)
    .filter(([key]) => !existingKeys.has(key))
    .map(([key, value]) => `${key}=${value}`);
  return `${lines.join("\n").replace(/\n+$/, "")}\n\n${additions.join("\n")}\n`;
}

const original = fs.readFileSync(ENV_PATH, "utf8");
const env = parseEnv(original);
const configuredRoles = REQUIRED_ROLES.filter((key) => env[key]);

if (configuredRoles.length === REQUIRED_ROLES.length) {
  console.log("Testnet roles are already configured; no accounts were created.");
  process.exit(0);
}
if (configuredRoles.length > 0) {
  const missing = REQUIRED_ROLES.filter((key) => !env[key]);
  throw new Error(`Refusing partial provisioning; missing ${missing.join(", ")}`);
}

const bootstrapValue = env.PRIV_KEY;
if (!bootstrapValue) {
  throw new Error("PRIV_KEY is required to provision testnet demo accounts");
}
const payerKey = parseEcdsaKey(bootstrapValue);
const payerAccountId = await resolveAccountId(payerKey);
const client = Client.forTestnet().setOperator(
  AccountId.fromString(payerAccountId),
  payerKey,
);

try {
  const facilitator = await createAccount(client, 10);
  const recipient = await createAccount(client, 1);
  const values = {
    HEDERA_PAYER_ACCOUNT_ID: payerAccountId,
    HEDERA_PAYER_PRIVATE_KEY: bootstrapValue,
    HEDERA_FACILITATOR_ACCOUNT_ID: facilitator.accountId,
    HEDERA_FACILITATOR_PRIVATE_KEY: facilitator.privateKey,
    PROOFBOUND_PAY_TO: recipient.accountId,
    PROOFBOUND_ASSET: env.PROOFBOUND_ASSET || "0.0.0",
    PROOFBOUND_AMOUNT: env.PROOFBOUND_AMOUNT || "1000000",
    PROOFBOUND_CHALLENGE_TTL_SECONDS: env.PROOFBOUND_CHALLENGE_TTL_SECONDS || "120",
    HEDERA_MIRROR_NODE_URL:
      env.HEDERA_MIRROR_NODE_URL || "https://testnet.mirrornode.hedera.com",
    PROOFBOUND_RESOURCE_BASE_URL:
      env.PROOFBOUND_RESOURCE_BASE_URL || "http://localhost:4402",
  };
  fs.writeFileSync(ENV_PATH, updateEnv(original, values), { mode: 0o600 });
  fs.chmodSync(ENV_PATH, 0o600);
  console.log("Provisioned distinct payer, facilitator, and recipient roles on Hedera testnet.");
  console.log(`Facilitator creation transaction: ${facilitator.transactionId}`);
  console.log(`Recipient creation transaction: ${recipient.transactionId}`);
} finally {
  client.close();
}
