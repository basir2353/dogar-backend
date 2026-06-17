import { rmSync, mkdirSync } from "node:fs";
import { build } from "esbuild";

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });

await build({
  entryPoints: ["src/server.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: "dist/server.js",
  packages: "external",
  logLevel: "info"
});

console.log("[build] dist/server.js ready");
