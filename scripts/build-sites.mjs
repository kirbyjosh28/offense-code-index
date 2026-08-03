import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const client = path.join(dist, "client");
const server = path.join(dist, "server");

await rm(dist, { recursive: true, force: true });
await mkdir(path.join(client, "src", "data"), { recursive: true });
await mkdir(server, { recursive: true });

await Promise.all([
  cp(path.join(root, "index.html"), path.join(client, "index.html")),
  cp(path.join(root, "styles.css"), path.join(client, "styles.css")),
  cp(path.join(root, "app.js"), path.join(client, "app.js")),
  cp(
    path.join(root, "src", "data", "offense-codes.json"),
    path.join(client, "src", "data", "offense-codes.json")
  ),
  cp(path.join(root, "worker", "index.js"), path.join(server, "index.js")),
]);

console.log("Built Sites bundle in dist/");
