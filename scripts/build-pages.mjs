import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const apiDir = path.join("src", "app", "api");
if (fs.existsSync(apiDir)) {
  fs.rmSync(apiDir, { recursive: true, force: true });
}

const env = {
  ...process.env,
  GITHUB_PAGES: "true",
  NEXT_PUBLIC_BASE_PATH: "/for_niteos",
  NEXT_PUBLIC_STATIC_EXPORT: "true",
};

const r = spawnSync("npx", ["next", "build"], {
  stdio: "inherit",
  env,
  shell: true,
});
process.exit(r.status ?? 1);
