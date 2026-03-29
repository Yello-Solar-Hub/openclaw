// Windows-compatible version of runtime-postbuild
// Uses copy instead of rename for node_modules

import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { execSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function listBundledPluginRuntimeDirs(repoRoot) {
  const distExtensionsDir = path.join(repoRoot, "dist", "extensions");
  if (!fs.existsSync(distExtensionsDir)) {
    return [];
  }
  const entries = fs.readdirSync(distExtensionsDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => path.join(distExtensionsDir, e.name));
}

function installPluginRuntimeDeps({ pluginDir, pluginId }) {
  const nodeModulesDir = path.join(pluginDir, "node_modules");
  console.log(`Installing runtime deps for ${pluginId}...`);
  execSync(`npm install --prefix "${pluginDir}" --omit=dev`, {
    stdio: "inherit",
  });
}

export function runRuntimePostBuild() {
  console.log("Running Windows-compatible runtime post-build...");
  for (const pluginDir of listBundledPluginRuntimeDirs(repoRoot)) {
    const pluginId = path.basename(pluginDir);
    const packageJsonPath = path.join(pluginDir, "package.json");
    if (!fs.existsSync(packageJsonPath)) {
      continue;
    }
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    const shouldStage =
      packageJson.openclaw?.bundle?.stageRuntimeDependencies === true;
    if (!shouldStage) {
      continue;
    }
    installPluginRuntimeDeps({ pluginDir, pluginId });
  }
  console.log("Runtime post-build complete.");
}

runRuntimePostBuild();
