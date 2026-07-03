#!/usr/bin/env node
// Vendor CLI for signing FamilyBoard OTA release manifests.
// See docs/ota-update-plan.md. Mirrors the Ed25519 conventions of
// sign-license.mjs, but produces a DETACHED signature the on-device updater
// verifies with `openssl pkeyutl` (the Pi host has openssl but no Node).
//
// Usage:
//   node tool/sign-release.mjs keygen
//     Ed25519 keypair. Private key → tool/.release-private.pem (gitignored).
//     Public key → tool/release-pub.pem (PEM, baked into the OS image) and
//     printed as base64 SPKI for reference.
//
//   node tool/sign-release.mjs sign --in <manifest.json>
//     Signs the exact bytes of <manifest.json> with Ed25519 and writes
//     <manifest.json>.sig (base64 of the raw 64-byte signature). Upload both
//     files to updates.familyboard.ch.
//
//   node tool/sign-release.mjs verify --in <manifest.json> [--pub tool/release-pub.pem]
//     Local sanity check that the .sig verifies (does NOT use openssl — this is
//     the Node cross-check; the device uses openssl on the same inputs).

import {
  generateKeyPairSync,
  sign as cryptoSign,
  verify as cryptoVerify,
  createPrivateKey,
  createPublicKey,
} from "node:crypto";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRIVATE_KEY_PATH = resolve(__dirname, ".release-private.pem");
const PUBLIC_KEY_PATH = resolve(__dirname, "release-pub.pem");

function printUsage() {
  process.stderr.write(
    [
      "",
      "FamilyBoard OTA release signing tool",
      "",
      "  node tool/sign-release.mjs keygen",
      "      Generate an Ed25519 keypair.",
      "      Private → tool/.release-private.pem (gitignored — NEVER commit).",
      "      Public  → tool/release-pub.pem (baked into the OS image).",
      "",
      "  node tool/sign-release.mjs sign --in <manifest.json>",
      "      Sign the manifest; writes <manifest.json>.sig (base64 raw Ed25519).",
      "",
      "  node tool/sign-release.mjs verify --in <manifest.json> [--pub <pem>]",
      "      Verify a manifest against its .sig (Node cross-check).",
      "",
    ].join("\n") + "\n",
  );
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      args[arg.slice(2)] = argv[i + 1] ?? true;
      i++;
    }
  }
  return args;
}

function keygen() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");

  writeFileSync(PRIVATE_KEY_PATH, privateKey.export({ type: "pkcs8", format: "pem" }), {
    mode: 0o600,
  });
  writeFileSync(PUBLIC_KEY_PATH, publicKey.export({ type: "spki", format: "pem" }));

  const publicB64 = Buffer.from(publicKey.export({ type: "spki", format: "der" })).toString(
    "base64",
  );
  process.stdout.write("Private key → tool/.release-private.pem (keep offline, never commit)\n");
  process.stdout.write("Public key  → tool/release-pub.pem (bake into the OS image)\n");
  process.stdout.write("\nPublic key (base64 SPKI, for reference):\n" + publicB64 + "\n");
}

function requireInput(args) {
  const inPath = args["in"];
  if (!inPath || typeof inPath !== "string" || inPath === "true") {
    process.stderr.write("Error: --in <manifest.json> is required\n");
    printUsage();
    process.exit(1);
  }
  return resolve(process.cwd(), inPath);
}

function sign(args) {
  const manifestPath = requireInput(args);
  if (!existsSync(PRIVATE_KEY_PATH)) {
    process.stderr.write(
      "Error: tool/.release-private.pem not found. Run `node tool/sign-release.mjs keygen` first.\n",
    );
    process.exit(1);
  }
  // Sign the exact on-disk bytes — the updater verifies the same file it fetched,
  // so there is no JSON canonicalization to get wrong.
  const bytes = readFileSync(manifestPath);
  const privateKey = createPrivateKey(readFileSync(PRIVATE_KEY_PATH, "utf-8"));
  const sig = cryptoSign(null, bytes, privateKey);
  const sigPath = manifestPath + ".sig";
  writeFileSync(sigPath, sig.toString("base64") + "\n");
  process.stdout.write(`Signed → ${sigPath}\n`);
}

function verify(args) {
  const manifestPath = requireInput(args);
  const pubPath = typeof args["pub"] === "string" ? resolve(process.cwd(), args["pub"]) : PUBLIC_KEY_PATH;
  const sigPath = manifestPath + ".sig";
  if (!existsSync(sigPath)) {
    process.stderr.write(`Error: ${sigPath} not found.\n`);
    process.exit(1);
  }
  const bytes = readFileSync(manifestPath);
  const sig = Buffer.from(readFileSync(sigPath, "utf-8").trim(), "base64");
  const publicKey = createPublicKey(readFileSync(pubPath, "utf-8"));
  const ok = cryptoVerify(null, bytes, publicKey, sig);
  process.stdout.write(ok ? "OK: signature valid\n" : "FAIL: signature invalid\n");
  process.exit(ok ? 0 : 1);
}

const [, , command, ...rest] = process.argv;
if (command === "keygen") keygen();
else if (command === "sign") sign(parseArgs(rest));
else if (command === "verify") verify(parseArgs(rest));
else {
  printUsage();
  process.exit(command ? 1 : 0);
}
