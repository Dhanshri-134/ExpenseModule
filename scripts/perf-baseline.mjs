import fs from "node:fs";
import path from "node:path";

const appRoot = path.resolve(process.cwd());
const manifestPath = path.join(appRoot, ".next", "build-manifest.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function toKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

if (!fs.existsSync(manifestPath)) {
  console.log("No build manifest found. Run `npm run build` first.");
  process.exit(0);
}

const manifest = readJson(manifestPath);
const pages = manifest.pages || {};
const summary = Object.entries(pages)
  .map(([route, files]) => ({
    route,
    assetCount: Array.isArray(files) ? files.length : 0,
    jsAssets: (files || []).filter((file) => file.endsWith(".js")),
  }))
  .sort((a, b) => b.jsAssets.length - a.jsAssets.length);

const topRoutes = summary.slice(0, 10);
const buildFiles = new Set(
  summary.flatMap((entry) => entry.jsAssets.map((file) => path.join(appRoot, ".next", file)))
);

let totalJsBytes = 0;
for (const filePath of buildFiles) {
  if (!fs.existsSync(filePath)) continue;
  totalJsBytes += fs.statSync(filePath).size;
}

console.log("Build baseline");
console.log(`Routes analyzed: ${summary.length}`);
console.log(`Unique JS payload: ${toKb(totalJsBytes)}`);
console.log("Top routes by JS asset count:");
for (const entry of topRoutes) {
  console.log(`- ${entry.route}: ${entry.jsAssets.length} JS assets (${entry.assetCount} total assets)`);
}
