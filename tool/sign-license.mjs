#!/usr/bin/env node
// Vendor CLI for FamilyBoard license key management.
//
// Usage:
//   node tool/sign-license.mjs keygen
//     Generates an Ed25519 keypair. Writes the private key to tool/.license-private.pem
//     and prints the public key (base64 SPKI DER) for LICENSE_PUBLIC_KEY.
//
//   node tool/sign-license.mjs sign --device <serial> --plan <home|pro> [--until YYYY-MM-DD]
//     Signs a license payload for the given device serial and plan.
//     Prints the FB1.<payload>.<sig> key string.

import { generateKeyPairSync, sign as cryptoSign, createPrivateKey } from "node:crypto";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRIVATE_KEY_PATH = resolve(__dirname, ".license-private.pem");

function printUsage() {
  process.stderr.write(
    [
      "",
      "FamilyBoard license key tool",
      "",
      "  node tool/sign-license.mjs keygen",
      "      Generate an Ed25519 keypair.",
      "      Private key → tool/.license-private.pem (gitignored — never commit this).",
      "      Public key (base64) → printed to stdout for LICENSE_PUBLIC_KEY.",
      "",
      "  node tool/sign-license.mjs sign --device <serial> --plan <home|pro> [--until YYYY-MM-DD]",
      "      Sign a license for the given Pi serial number.",
      "      --device   Pi serial or UUID from GET /api/license (deviceId field)",
      "      --plan     home | pro",
      "      --until    optional expiry date (ISO 8601 date, e.g. 2027-12-31)",
      "",
    ].join("\n") + "\n",
  );
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      args[key] = argv[i + 1] ?? true;
      i++;
    }
  }
  return args;
}

function keygen() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");

  const privatePem = privateKey.export({ type: "pkcs8", format: "pem" });
  writeFileSync(PRIVATE_KEY_PATH, privatePem, { mode: 0o600 });

  const publicDer = publicKey.export({ type: "spki", format: "der" });
  const publicB64 = Buffer.from(publicDer).toString("base64");

  process.stdout.write("Private key written to: tool/.license-private.pem\n");
  process.stdout.write("\nLICENSE_PUBLIC_KEY (paste into .env):\n");
  process.stdout.write(publicB64 + "\n");
}

function signLicense(args) {
  const device = args["device"];
  const plan = args["plan"];
  const until = args["until"];

  if (!device || typeof device !== "string" || device === "true") {
    process.stderr.write("Error: --device <serial> is required\n");
    printUsage();
    process.exit(1);
  }

  if (!plan || (plan !== "home" && plan !== "pro")) {
    process.stderr.write("Error: --plan must be 'home' or 'pro'\n");
    printUsage();
    process.exit(1);
  }

  if (!existsSync(PRIVATE_KEY_PATH)) {
    process.stderr.write(
      "Error: tool/.license-private.pem not found. Run `node tool/sign-license.mjs keygen` first.\n",
    );
    process.exit(1);
  }

  const payload = {
    v: 1,
    deviceId: device,
    plan,
    issuedAt: new Date().toISOString(),
    ...(until ? { validUntil: new Date(until).toISOString() } : {}),
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");

  const privatePem = readFileSync(PRIVATE_KEY_PATH, "utf-8");
  const privateKey = createPrivateKey(privatePem);

  // Ed25519 uses null algorithm — key type implies the signature scheme.
  const sigBuf = cryptoSign(null, Buffer.from(payloadB64, "utf-8"), privateKey);
  const sigB64 = sigBuf.toString("base64url");

  const licenseKey = `FB1.${payloadB64}.${sigB64}`;
  process.stdout.write(licenseKey + "\n");
}

// Mint an FBL1 lease directly (what the license Worker issues on check-in).
// For local testing of the device-side verifyLease without the Worker.
function signLease(args) {
  const device = args["device"];
  const plan = args["plan"] === "pro" ? "pro" : "home";
  const days = Number(args["days"]) || 30;

  if (!device || typeof device !== "string" || device === "true") {
    process.stderr.write("Error: --device <serial> is required\n");
    process.exit(1);
  }
  if (!existsSync(PRIVATE_KEY_PATH)) {
    process.stderr.write(
      "Error: tool/.license-private.pem not found. Run `node tool/sign-license.mjs keygen` first.\n",
    );
    process.exit(1);
  }

  const payload = {
    v: 1,
    deviceId: device,
    plan,
    status: "active",
    issuedAt: new Date().toISOString(),
    leaseUntil: new Date(Date.now() + days * 86_400_000).toISOString(),
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const privateKey = createPrivateKey(readFileSync(PRIVATE_KEY_PATH, "utf-8"));
  const sigB64 = cryptoSign(null, Buffer.from(payloadB64, "utf-8"), privateKey).toString("base64url");

  process.stdout.write(`FBL1.${payloadB64}.${sigB64}\n`);
}

const [, , command, ...rest] = process.argv;

if (command === "keygen") {
  keygen();
} else if (command === "sign") {
  signLicense(parseArgs(rest));
} else if (command === "lease") {
  signLease(parseArgs(rest));
} else {
  printUsage();
  process.exit(command ? 1 : 0);
}
