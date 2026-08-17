import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createBuildId } from "./build-version.mjs";
import { buildLookupIndex } from "./build-lookup-index.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const client = path.join(dist, "client");
const server = path.join(dist, "server");

await rm(dist, { recursive: true, force: true });
await mkdir(path.join(client, "src", "data"), { recursive: true });
await mkdir(path.join(client, "trust"), { recursive: true });
await mkdir(path.join(client, ".well-known"), { recursive: true });
await mkdir(path.join(client, "config"), { recursive: true });
await mkdir(server, { recursive: true });

const trustFiles = [
  "privacy.html",
  "terms.html",
  "accessibility.html",
  "security.html",
  "sources.html",
  "corrections.html",
];
const publicImages = ["og.png", "og-v2.png", "og-v3.png", "og-v4.png", "og-v5.png"];
const complianceFiles = [
  "README.md",
  "threat-model.md",
  "data-flow.md",
  "accessibility-evidence.md",
  "rollback.md",
  "release-checklist.md",
];

const appSource = await readFile(path.join(root, "app.js"), "utf8");

/**
 * Client modules, derived from what app.js imports rather than listed by hand.
 *
 * A hand-maintained list shipped a build whose app.js imported ./src/family.js while the
 * build copied only three of the four modules: the import 404'd, the module graph never
 * evaluated, and the site rendered nothing. The dev server serves from the repo root, so
 * only the built output was ever broken. Deriving the list removes that whole class.
 */
const clientModules = [...appSource.matchAll(/from\s+"\.\/(src\/[\w./-]+\.js)"/g)].map((match) => match[1]);
if (!clientModules.length) throw new Error("No client modules found in app.js imports.");

const [
  indexHtml,
  workerTemplate,
  stylesSource,
  offenseData,
  sourceVersion,
  releaseGovernance,
  contentStatus,
  securityDisclosure,
  vercelConfig,
  packageLock,
  buildScript,
  ...hashedAssets
] = await Promise.all([
  readFile(path.join(root, "index.html"), "utf8"),
  readFile(path.join(root, "worker", "index.js"), "utf8"),
  readFile(path.join(root, "styles.css"), "utf8"),
  readFile(path.join(root, "src", "data", "offense-codes.json"), "utf8"),
  readFile(path.join(root, "config", "source-version.json"), "utf8"),
  readFile(path.join(root, "config", "release-governance.json"), "utf8"),
  readFile(path.join(root, "config", "content-status.json"), "utf8"),
  readFile(path.join(root, "public", ".well-known", "security.txt"), "utf8"),
  readFile(path.join(root, "vercel.json"), "utf8"),
  readFile(path.join(root, "package-lock.json"), "utf8"),
  readFile(fileURLToPath(import.meta.url), "utf8"),
  ...clientModules.map((file) => readFile(path.join(root, file), "utf8")),
  ...trustFiles.map((file) => readFile(path.join(root, "trust", file), "utf8")),
  ...publicImages.map((file) => readFile(path.join(root, "public", file))),
  ...complianceFiles.map((file) => readFile(path.join(root, "compliance", file), "utf8")),
]);
const clientModuleContents = hashedAssets.slice(0, clientModules.length);
const trustDocuments = hashedAssets.slice(clientModules.length, clientModules.length + trustFiles.length);
const publicImageContents = hashedAssets.slice(
  clientModules.length + trustFiles.length,
  clientModules.length + trustFiles.length + publicImages.length
);
const complianceDocuments = hashedAssets.slice(clientModules.length + trustFiles.length + publicImages.length);

if (!workerTemplate.includes('"__INDEX_HTML__"')) {
  throw new Error("Sites worker template is missing its HTML placeholder.");
}

/**
 * The runtime lookup index, and the statutory text chunks the detail view fetches on
 * demand. Both are derived from the frozen corpus plus the enrichment layer; the frozen
 * corpus itself is still published byte-identical below so anyone can verify it.
 *
 * Enrichment is optional: with no sweep results on disk this yields an index with no
 * statutory data and the interface degrades accordingly.
 */
const lookupIndex = await buildLookupIndex({ root });
const lookupIndexJson = `${JSON.stringify(lookupIndex)}\n`;

const sectionsDir = path.join(root, "src", "data", "enrichment", "sections");
let sectionFiles = [];
try {
  sectionFiles = (await readdir(sectionsDir)).filter((file) => file.endsWith(".json")).sort();
} catch {
  sectionFiles = [];
}
const sectionContents = await Promise.all(
  sectionFiles.map((file) => readFile(path.join(sectionsDir, file), "utf8"))
);

const buildMeta = '<meta name="app-build" content="dev" />';
if (!indexHtml.includes(buildMeta)) {
  throw new Error("Index document is missing its development build marker.");
}

const buildId = createBuildId([
  ["index.html", indexHtml],
  ["app.js", appSource],
  ["styles.css", stylesSource],
  ...clientModules.map((file, index) => [file, clientModuleContents[index]]),
  ["src/data/offense-codes.json", offenseData],
  ["src/data/lookup-index.json", lookupIndexJson],
  ...sectionFiles.map((file, index) => [`src/data/enrichment/sections/${file}`, sectionContents[index]]),
  ["config/source-version.json", sourceVersion],
  ["config/release-governance.json", releaseGovernance],
  ["config/content-status.json", contentStatus],
  ["public/.well-known/security.txt", securityDisclosure],
  ["worker/index.js", workerTemplate],
  ["vercel.json", vercelConfig],
  ["package-lock.json", packageLock],
  ["scripts/build-sites.mjs", buildScript],
  ...trustFiles.map((file, index) => [`trust/${file}`, trustDocuments[index]]),
  ...publicImages.map((file, index) => [`public/${file}`, publicImageContents[index]]),
  ...complianceFiles.map((file, index) => [
    `compliance/${file}`,
    complianceDocuments[index],
  ]),
]);
const builtIndexHtml = indexHtml.replace(
  buildMeta,
  `<meta name="app-build" content="${buildId}" />`
);
const sourceManifest = JSON.parse(sourceVersion);
const governanceManifest = JSON.parse(releaseGovernance);
const statusManifest = JSON.parse(contentStatus);
const versionManifest = `${JSON.stringify({
  build: buildId,
  appVersion: statusManifest.app.version,
  corpusVersion: statusManifest.corpus.version,
  corpusSha256: sourceManifest.corpus.sha256,
  sourceVersionId: sourceManifest.id,
})}\n`;

await Promise.all([
  writeFile(path.join(client, "index.html"), builtIndexHtml),
  writeFile(path.join(client, "version.json"), versionManifest),
  cp(path.join(root, "styles.css"), path.join(client, "styles.css")),
  cp(path.join(root, "app.js"), path.join(client, "app.js")),
  ...clientModules.map((file) => cp(path.join(root, file), path.join(client, file))),
  ...trustFiles.map((file) =>
    cp(path.join(root, "trust", file), path.join(client, "trust", file))
  ),
  cp(
    path.join(root, "public", ".well-known", "security.txt"),
    path.join(client, ".well-known", "security.txt")
  ),
  writeFile(path.join(client, "config", "source-version.json"), sourceVersion),
  writeFile(path.join(client, "config", "content-status.json"), contentStatus),
  ...publicImages.map((file) =>
    cp(path.join(root, "public", file), path.join(client, file))
  ),
  cp(
    path.join(root, "src", "data", "offense-codes.json"),
    path.join(client, "src", "data", "offense-codes.json")
  ),
  writeFile(path.join(client, "src", "data", "lookup-index.json"), lookupIndexJson),
  writeFile(
    path.join(server, "index.js"),
    workerTemplate.replace('"__INDEX_HTML__"', JSON.stringify(builtIndexHtml))
  ),
]);

// Statutory text ships as one file per section, fetched only when a detail view opens,
// so several megabytes of statute never enter the initial payload.
if (sectionFiles.length) {
  const sectionsOutput = path.join(client, "src", "data", "enrichment", "sections");
  await mkdir(sectionsOutput, { recursive: true });
  await Promise.all(
    sectionFiles.map((file, index) => writeFile(path.join(sectionsOutput, file), sectionContents[index]))
  );
}

const complianceOutput = path.join(dist, "compliance");
await mkdir(complianceOutput, { recursive: true });
await Promise.all(
  complianceFiles.map((file) =>
    cp(path.join(root, "compliance", file), path.join(complianceOutput, file))
  )
);

const lock = JSON.parse(packageLock);
const sbom = {
  bomFormat: "CycloneDX",
  specVersion: "1.6",
  version: 1,
  metadata: {
    component: {
      type: "application",
      name: lock.name,
      version: lock.version,
    },
  },
  components: Object.entries(lock.packages ?? {})
    .filter(([location]) => location)
    .map(([location, entry]) => ({
      type: "library",
      name: entry.name ?? path.basename(location),
      version: entry.version ?? "unknown",
    }))
    .sort((left, right) => left.name.localeCompare(right.name)),
};
const releaseEvidence = {
  schemaVersion: 1,
  appBuildId: buildId,
  appVersion: statusManifest.app.version,
  corpusVersion: statusManifest.corpus.version,
  corpusSha256: sourceManifest.corpus.sha256,
  sourceVersionId: sourceManifest.id,
  releaseId: governanceManifest.releaseId,
  releaseMode: governanceManifest.releaseMode,
  productionBlocked: governanceManifest.productionBlocked,
};
await Promise.all([
  writeFile(path.join(complianceOutput, "sbom.cdx.json"), `${JSON.stringify(sbom, null, 2)}\n`),
  writeFile(
    path.join(complianceOutput, "release-evidence.json"),
    `${JSON.stringify(releaseEvidence, null, 2)}\n`
  ),
]);

const checksumTree = async (directory, prefix) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const checksums = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) checksums.push(...(await checksumTree(absolutePath, relativePath)));
    else {
      const contents = await readFile(absolutePath);
      checksums.push({
        path: relativePath,
        sha256: createHash("sha256").update(contents).digest("hex"),
        bytes: contents.byteLength,
      });
    }
  }
  return checksums;
};
const artifactChecksums = [
  ...(await checksumTree(client, "client")),
  ...(await checksumTree(server, "server")),
];
await writeFile(
  path.join(complianceOutput, "artifact-checksums.json"),
  `${JSON.stringify({ schemaVersion: 1, build: buildId, files: artifactChecksums }, null, 2)}\n`
);

console.log(`Built static client and Sites worker bundles in dist/ (${buildId}).`);
