import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parseEnv } from "node:util";
const ignored = new Set([
  ".git",
  "node_modules",
  ".next",
  ".vercel",
  ".data",
  ".venv",
  "__pycache__",
  ".pytest_cache",
  ".ruff_cache",
  "test-results",
  "playwright-report",
]);
const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /gh[pousr]_[A-Za-z0-9]{30,}/,
  /github_pat_[A-Za-z0-9_]{40,}/,
  /AKIA[0-9A-Z]{16}/,
  /(?:api[_-]?key|access[_-]?token|password|secret)\s*[:=]\s*["'][^"'\s]{16,}["']/i,
];
const problems = [];
let checked = 0;
function walk(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(item.name)) continue;
    const file = path.join(dir, item.name);
    if (item.isDirectory()) {
      walk(file);
      continue;
    }
    if (item.name === ".env.example") {
      const template = parseEnv(fs.readFileSync(file, "utf8"));
      for (const name of [
        "APISH_KEY",
        "PILOT_ACCESS_TOKEN",
        "SUPABASE_SERVICE_ROLE_KEY",
      ])
        if (template[name])
          problems.push(`${file}: ${name} must remain an empty placeholder`);
      continue;
    }
    if (item.name.startsWith(".env") && item.name !== ".env.example") {
      // Local server credentials are expected, but must never be tracked.
      const { status } = spawnSync(
        "git",
        ["ls-files", "--error-unmatch", "--", file],
        { stdio: "ignore" },
      );
      if (status === 0) problems.push(`${file}: environment file is tracked`);
      continue;
    }
    if (!/\.(tsx?|m?js|json|md|ya?ml|css|sql|py)$/.test(file)) continue;
    const contents = fs.readFileSync(file, "utf8");
    checked++;
    if (patterns.some((p) => p.test(contents)))
      problems.push(`${file}: possible secret; value withheld`);
    if (file.endsWith(".tsx") && /dangerouslySetInnerHTML/.test(contents))
      problems.push(`${file}: raw HTML sink`);
  }
}
walk(".");
if (problems.length) {
  console.error(problems.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    `Security source checks passed (${checked} files). Heuristic scan; not a penetration test.`,
  );
