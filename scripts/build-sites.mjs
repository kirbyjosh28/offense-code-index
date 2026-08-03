import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const client = path.join(dist, "client");
const server = path.join(dist, "server");

await rm(dist, { recursive: true, force: true });
await mkdir(path.join(client, "src", "data"), { recursive: true });
await mkdir(server, { recursive: true });

const [indexHtml, workerTemplate] = await Promise.all([
  readFile(path.join(root, "index.html"), "utf8"),
  readFile(path.join(root, "worker", "index.js"), "utf8"),
]);

if (!workerTemplate.includes('"__INDEX_HTML__"')) {
  throw new Error("Sites worker template is missing its HTML placeholder.");
}

await Promise.all([
  cp(path.join(root, "styles.css"), path.join(client, "styles.css")),
  cp(path.join(root, "app.js"), path.join(client, "app.js")),
  cp(path.join(root, "src", "search.js"), path.join(client, "src", "search.js")),
  cp(path.join(root, "public", "og.png"), path.join(client, "og.png")),
  cp(path.join(root, "public", "og-v2.png"), path.join(client, "og-v2.png")),
  cp(path.join(root, "public", "og-v3.png"), path.join(client, "og-v3.png")),
  cp(path.join(root, "public", "og-v4.png"), path.join(client, "og-v4.png")),
  cp(
    path.join(root, "src", "data", "offense-codes.json"),
    path.join(client, "src", "data", "offense-codes.json")
  ),
  writeFile(
    path.join(server, "index.js"),
    workerTemplate.replace('"__INDEX_HTML__"', JSON.stringify(indexHtml))
  ),
]);

console.log("Built Sites bundle in dist/");
