import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { journeyFixtures } from "./fixtures";
const python = resolve(
  process.platform === "win32"
    ? ".venv/Scripts/python.exe"
    : ".venv/bin/python",
);
const result = spawnSync(python, ["-m", "api.seed_fixtures"], {
  input: JSON.stringify(journeyFixtures()),
  stdio: ["pipe", "inherit", "inherit"],
});
process.exitCode = result.status ?? 1;
