#!/usr/bin/env node
/* eslint-disable no-console */

// Lightweight static security audit just so I don't push anything stupid.
import { readdir, readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SRC = resolve(ROOT, "src");

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
};

async function* walk(dir) {
  const SKIP_DIRS = new Set([
    "node_modules",
    ".next",
    "dist",
    "build",
    "coverage",
    ".turbo",
  ]);
  const SOURCE_EXT = /\.(?:ts|tsx|js|mjs|cjs)$/;

  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile() && SOURCE_EXT.test(entry.name)) {
      yield full;
    }
  }
}

function findLineMatches(content, pattern) {
  const matches = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) {
      matches.push([i + 1, lines[i]]);
    }
  }
  return matches;
}

function rel(absPath) {
  return relative(ROOT, absPath);
}

function isAllowedEncryptionKeyFile(relPath) {
  return relPath === "src/lib/crypto.ts" || relPath === "src/lib/crypto.test.ts";
}

function isAuthRoute(relPath) {
  return relPath.startsWith("src/app/api/auth/");
}

function isApiRoute(relPath) {
  return /^src\/app\/api\/.+\/route\.(?:ts|tsx|js)$/.test(relPath);
}

function reportFindings(label, findings) {
  if (findings.length === 0) {
    console.log(`  ${c.green("✓")} ${label}`);
    return 0;
  }
  console.log(`  ${c.red("✗")} ${label} ${c.dim(`(${findings.length} finding${findings.length === 1 ? "" : "s"})`)}`);
  for (const finding of findings) {
    console.log(`    ${c.yellow(finding.location)} ${c.dim(finding.snippet)}`);
  }
  return findings.length;
}

async function main() {
  console.log(c.bold("\n  Security audit\n"));

  const files = [];
  for await (const f of walk(SRC)) files.push(f);

  /** @type {{ encryptionKey: any[], bareEnv: any[], evalish: any[], unauthedRoutes: any[] }} */
  const findings = {
    encryptionKey: [],
    bareEnv: [],
    evalish: [],
    unauthedRoutes: [],
  };

  const ENCRYPTION_KEY_RE = /ENCRYPTION_KEY/;
  const BARE_ENV_RE = /process\.env(?![.\w])/;
  const EVAL_RE = /\beval\s*\(|\bnew\s+Function\s*\(/;

  for (const abs of files) {
    const relPath = rel(abs).replaceAll("\\", "/");
    const content = await readFile(abs, "utf8");

    // 1. ENCRYPTION_KEY scoped to the crypto module.
    if (!isAllowedEncryptionKeyFile(relPath) && ENCRYPTION_KEY_RE.test(content)) {
      for (const [line, text] of findLineMatches(content, ENCRYPTION_KEY_RE)) {
        findings.encryptionKey.push({
          location: `${relPath}:${line}`,
          snippet: text.trim(),
        });
      }
    }

    // 2. Bare process.env references.
    for (const [line, text] of findLineMatches(content, BARE_ENV_RE)) {
      findings.bareEnv.push({
        location: `${relPath}:${line}`,
        snippet: text.trim(),
      });
    }

    // 3. eval / new Function.
    for (const [line, text] of findLineMatches(content, EVAL_RE)) {
      findings.evalish.push({
        location: `${relPath}:${line}`,
        snippet: text.trim(),
      });
    }

    // 4. API route handlers must call auth().
    if (isApiRoute(relPath) && !isAuthRoute(relPath) && !/\bauth\s*\(/.test(content)) {
      findings.unauthedRoutes.push({
        location: relPath,
        snippet: "no auth() reference found",
      });
    }
  }

  let total = 0;
  total += reportFindings(
    "ENCRYPTION_KEY only read from src/lib/crypto.ts",
    findings.encryptionKey,
  );
  total += reportFindings(
    "No bare process.env references (use process.env.NAME)",
    findings.bareEnv,
  );
  total += reportFindings(
    "No eval() or new Function() in source",
    findings.evalish,
  );
  total += reportFindings(
    "Every API route handler references auth()",
    findings.unauthedRoutes,
  );

  console.log();
  if (total === 0) {
    console.log(`  ${c.green("All checks passed.")}\n`);
    process.exit(0);
  }

  console.log(
    `  ${c.red(`Found ${total} security audit finding${total === 1 ? "" : "s"}.`)}`,
  );
  console.log(
    `  ${c.dim("If a finding is intentional, narrow the allowlist in scripts/security-audit.mjs.")}\n`,
  );
  process.exit(1);
}

main().catch((err) => {
  console.error(c.red("Security audit crashed:"), err);
  process.exit(2);
});
