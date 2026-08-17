import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const mimeFor = (pathname) => {
  if (pathname.endsWith(".html")) return "text/html; charset=utf-8";
  if (pathname.endsWith(".css")) return "text/css; charset=utf-8";
  if (pathname.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (pathname.endsWith(".json")) return "application/json; charset=utf-8";
  return "application/octet-stream";
};

const render = async (pathname = "/", method = "GET") => {
  const workerUrl = pathToFileURL(path.join(root, "dist", "server", "index.js"));
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`https://example.test${pathname}`, { method }),
    {
      ASSETS: {
        fetch: async (request) => {
          const url = new URL(request.url);
          try {
            const body = await readFile(path.join(root, "dist", "client", url.pathname));
            return new Response(body, { headers: { "Content-Type": mimeFor(url.pathname) } });
          } catch {
            return new Response("Not found", { status: 404 });
          }
        },
      },
    }
  );
};

test("the Sites worker serves the finished index and its defensive headers", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html/);
  assert.match(response.headers.get("content-security-policy") ?? "", /default-src 'self'/);
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.match(await response.text(), /Independent Illinois Offense Code Reference/);
  assert.match(
    await readFile(path.join(root, "index.html"), "utf8"),
    /illinois-offense-code-index\.vercel\.app\/og-v5\.png/
  );
});

test("the static Vercel bundle contains the finished index document", async () => {
  const staticIndex = await readFile(path.join(root, "dist", "client", "index.html"), "utf8");
  const version = JSON.parse(await readFile(path.join(root, "dist", "client", "version.json"), "utf8"));
  assert.match(staticIndex, /Independent Illinois Offense Code Reference/);
  assert.match(staticIndex, /id="search-experience"/);
  assert.match(staticIndex, /id="search-tools"/);
  assert.match(version.build, /^[a-f0-9]{12}$/);
  assert.equal(version.appVersion, "1.0.0");
  assert.equal(version.corpusVersion, "2024-02.extract-v1");
  assert.match(version.corpusSha256, /^[a-f0-9]{64}$/);
  assert.match(staticIndex, new RegExp(`<meta name="app-build" content="${version.build}" \\/>`));
  assert.doesNotMatch(staticIndex, /<meta name="app-build" content="dev" \/>/);
});

test("the Sites worker and version artifact expose the same production build", async () => {
  const [documentResponse, versionResponse] = await Promise.all([
    render(),
    render("/version.json"),
  ]);
  const document = await documentResponse.text();
  const version = await versionResponse.json();

  assert.equal(versionResponse.status, 200);
  assert.equal(versionResponse.headers.get("cache-control"), "no-store, max-age=0");
  assert.match(document, new RegExp(`<meta name="app-build" content="${version.build}" \\/>`));
});

test("the Sites bundle contains the complete structured dataset", async () => {
  const response = await render("/src/data/offense-codes.json");
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.offenses.length, 953);
  assert.equal(data.counties.length, 103);
});

test("the Sites bundle serves client modules, trust evidence, and the current social preview", async () => {
  const [searchModule, freshnessModule, shareModule, privacyPage, sourceStatus, securityText, socialPreview] = await Promise.all([
    render("/src/search.js"),
    render("/src/freshness.js"),
    render("/src/share-state.js"),
    render("/trust/privacy.html"),
    render("/config/source-version.json"),
    render("/.well-known/security.txt"),
    render("/og-v5.png"),
  ]);
  assert.equal(searchModule.status, 200);
  assert.match(await searchModule.text(), /scoreOffenseMatch/);
  assert.equal(freshnessModule.status, 200);
  assert.match(await freshnessModule.text(), /createFreshnessMonitor/);
  assert.equal(shareModule.status, 200);
  assert.match(await shareModule.text(), /serializeShareState/);
  assert.equal(privacyPage.status, 200);
  assert.match(await privacyPage.text(), /Privacy notice/);
  assert.equal(sourceStatus.status, 200);
  assert.equal(sourceStatus.headers.get("cache-control"), "no-store, max-age=0");
  assert.equal((await sourceStatus.json()).corpus.recordCount, 953);
  assert.equal(securityText.status, 200);
  assert.match(await securityText.text(), /Contact: https:\/\/github\.com\/kirbyjosh28\/offense-code-index\/issues/);
  assert.equal(socialPreview.status, 200);
  assert.ok((await socialPreview.arrayBuffer()).byteLength > 100_000);
});

test("the Sites worker rejects mutating HTTP methods", async () => {
  const response = await render("/", "POST");
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET, HEAD");
});

test("the build emits a checksummed owner-attested compliance evidence package", async () => {
  const evidenceRoot = path.join(root, "dist", "compliance");
  const [evidence, sbom, checksums, threatModel, rollback] = await Promise.all([
    readFile(path.join(evidenceRoot, "release-evidence.json"), "utf8").then(JSON.parse),
    readFile(path.join(evidenceRoot, "sbom.cdx.json"), "utf8").then(JSON.parse),
    readFile(path.join(evidenceRoot, "artifact-checksums.json"), "utf8").then(JSON.parse),
    readFile(path.join(evidenceRoot, "threat-model.md"), "utf8"),
    readFile(path.join(evidenceRoot, "rollback.md"), "utf8"),
  ]);
  assert.equal(evidence.releaseId, "2026-08-10-owner-attested");
  assert.equal(evidence.releaseMode, "production");
  assert.equal(evidence.productionBlocked, false);
  assert.equal(sbom.bomFormat, "CycloneDX");
  assert.ok(checksums.files.some(({ path: file }) => file === "client/index.html"));
  assert.ok(checksums.files.some(({ path: file }) => file === "server/index.js"));
  assert.match(threatModel, /Query disclosure/);
  assert.match(rollback, /Application and corpus versions are independent/);
});
