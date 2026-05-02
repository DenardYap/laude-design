#!/usr/bin/env node
/* eslint-disable no-console */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ENV_PATH = resolve(ROOT, ".env");
const ENV_EXAMPLE_PATH = resolve(ROOT, ".env.example");

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
};

function step(label) {
  console.log(`\n${c.cyan("▸")} ${c.bold(label)}`);
}

function info(label) {
  console.log(`  ${c.dim(label)}`);
}

function fail(message) {
  console.error(`\n${c.red("✗")} ${message}\n`);
  process.exit(1);
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { stdio: "inherit", cwd: ROOT, ...opts });
  if (result.error) fail(`${cmd} not found: ${result.error.message}`);
  if (result.status !== 0) fail(`${cmd} ${args.join(" ")} exited with ${result.status}`);
}

function ensureDocker() {
  step("Checking Docker");
  const probe = spawnSync("docker", ["info"], { stdio: "ignore" });
  if (probe.status !== 0) {
    fail(
      "Docker doesn't appear to be running. Start Docker Desktop (or your Docker daemon) and re-run pnpm dev.",
    );
  }
  info("Docker daemon is reachable.");
}

function ensureEnv() {
  step("Checking .env");
  if (!existsSync(ENV_PATH)) {
    if (!existsSync(ENV_EXAMPLE_PATH)) {
      fail("Neither .env nor .env.example exist. Cannot continue.");
    }
    copyFileSync(ENV_EXAMPLE_PATH, ENV_PATH);
    info("Copied .env.example → .env");
  }

  let raw = readFileSync(ENV_PATH, "utf8");
  const generated = [];

  for (const key of ["AUTH_SECRET", "ENCRYPTION_KEY"]) {
    const re = new RegExp(`^${key}\\s*=\\s*"?\\s*"?\\s*$`, "m");
    if (re.test(raw)) {
      const value = randomBytes(32).toString("base64");
      raw = raw.replace(re, `${key}="${value}"`);
      generated.push(key);
    }
  }

  if (generated.length > 0) {
    writeFileSync(ENV_PATH, raw, "utf8");
    info(`Generated dev secrets for: ${generated.join(", ")}`);
  } else {
    info(".env looks good.");
  }

  const missingOAuth = [];
  for (const key of ["AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET", "AUTH_GITHUB_ID", "AUTH_GITHUB_SECRET"]) {
    const re = new RegExp(`^${key}\\s*=\\s*"?\\s*"?\\s*$`, "m");
    if (re.test(raw)) missingOAuth.push(key);
  }
  if (missingOAuth.length > 0) {
    console.log(
      `  ${c.yellow("!")} OAuth not configured yet: ${missingOAuth.join(", ")}.`,
    );
    info("Sign-in won't work until you fill these in (see .env comments for setup links).");
  }
}

function startPostgres() {
  step("Starting Postgres (docker compose up -d --wait db)");
  run("docker", ["compose", "up", "-d", "--wait", "db"]);
}

function applyMigrations() {
  step("Applying Prisma migrations");
  run("pnpm", ["prisma", "migrate", "deploy"]);
}

// Routes the dev server should compile up-front so the first navigation to
// each page doesn't have to wait for on-demand compilation. Add new pages
// here as they're created.
const PREWARM_ROUTES = ["/", "/projects", "/skills", "/api-keys", "/sign-in"];

async function waitForServer(baseUrl, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(baseUrl, { redirect: "manual" });
      if (res.status > 0) return true;
    } catch {
      // server not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

function prewarmRoutes(port) {
  const baseUrl = `http://localhost:${port}`;
  (async () => {
    const ready = await waitForServer(baseUrl, 60_000);
    if (!ready) return;
    console.log(`\n  ${c.dim("Pre-warming routes so first navigation is instant…")}`);
    await Promise.all(
      PREWARM_ROUTES.map((route) =>
        fetch(`${baseUrl}${route}`, { redirect: "manual" }).catch(() => {}),
      ),
    );
    console.log(`  ${c.dim(`Pre-warmed ${PREWARM_ROUTES.length} routes.`)}`);
  })();
}

function runNextDev() {
  step("Starting Next.js dev server");
  info("Frontend + backend on http://localhost:3000");
  console.log("");

  const port = process.env.PORT ?? "3000";

  const child = spawn("pnpm", ["exec", "next", "dev", "--turbopack"], {
    stdio: "inherit",
    cwd: ROOT,
    env: process.env,
  });

  prewarmRoutes(port);

  const forward = (signal) => {
    if (!child.killed) child.kill(signal);
  };
  process.on("SIGINT", () => forward("SIGINT"));
  process.on("SIGTERM", () => forward("SIGTERM"));

  child.on("exit", (code, signal) => {
    process.exit(signal ? 0 : (code ?? 0));
  });
}

ensureDocker();
ensureEnv();
startPostgres();
applyMigrations();
runNextDev();
