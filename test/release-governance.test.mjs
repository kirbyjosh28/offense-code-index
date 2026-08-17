import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateRelease } from "../scripts/validate-release.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const readJson = async (relativePath) =>
  JSON.parse(await readFile(path.join(ROOT, relativePath), "utf8"));

const createFixture = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "release-governance-"));
  await Promise.all([
    mkdir(path.join(root, "config"), { recursive: true }),
    mkdir(path.join(root, "src", "data"), { recursive: true }),
    mkdir(path.join(root, "trust"), { recursive: true }),
    mkdir(path.join(root, "public", ".well-known"), { recursive: true }),
    mkdir(path.join(root, "compliance", "private"), { recursive: true }),
  ]);
  const files = [
    "package.json",
    "config/source-version.json",
    "config/release-governance.json",
    "config/content-status.json",
    "src/data/offense-codes.json",
    "trust/privacy.html",
    "trust/terms.html",
    "trust/accessibility.html",
    "trust/security.html",
    "trust/sources.html",
    "trust/corrections.html",
    "public/.well-known/security.txt",
  ];
  await Promise.all(
    files.map(async (relativePath) => {
      const destination = path.join(root, relativePath);
      await writeFile(destination, await readFile(path.join(ROOT, relativePath)));
    })
  );
  return root;
};

test("checked-in governance preserves a valid 953-record corpus", async () => {
  const result = await validateRelease({ root: ROOT, mode: "draft" });
  assert.deepEqual(result, { mode: "draft", releaseId: "2026-08-10-owner-attested", records: 953 });
});

test("checked-in production records owner attestation and missing external legal review", async () => {
  const result = await validateRelease({
    root: ROOT,
    mode: "production",
    now: new Date("2026-08-10T00:00:00.000Z"),
  });
  assert.deepEqual(result, {
    mode: "production",
    releaseId: "2026-08-10-owner-attested",
    records: 953,
  });
});

test("production accepts only a fully approved and reviewed release", async () => {
  const root = await createFixture();
  const verifiedSource = Buffer.alloc(2048);
  verifiedSource.write("%PDF-1.7\nverified source fixture", "ascii");
  const source = await readJson("config/source-version.json");
  source.sourceArtifact.verificationPath = "compliance/private/source.pdf";
  source.sourceArtifact.sha256 = createHash("sha256").update(verifiedSource).digest("hex");
  source.sourceArtifact.hashStatus = "verified";
  source.rights = { status: "approved", approvalReference: "RIGHTS-2026-001" };
  source.review = {
    status: "active",
    lastReviewedDate: "2026-08-01",
    nextReviewDate: "2027-02-01",
    supersededBy: null,
  };

  const governance = await readJson("config/release-governance.json");
  governance.releaseId = "2026-08-approved";
  governance.releaseMode = "production";
  governance.operator = { legalName: "Example Operator LLC", contact: "legal@example.com" };
  governance.owners = {
    content: "Content Owner",
    privacy: "Privacy Owner",
    security: "Security Owner",
    accessibility: "Accessibility Owner",
  };
  governance.contacts = {
    privacy: "privacy@example.com",
    security: "security@example.com",
    accessibility: "accessibility@example.com",
  };
  governance.approvals = Object.fromEntries(
    Object.keys(governance.approvals).map((name) => [
      name,
      { status: "approved", reference: `${name.toUpperCase()}-2026-001`, approvedAt: "2026-08-01" },
    ])
  );
  governance.corrections = { contact: "corrections@example.com", responseSlaBusinessDays: 5 };
  governance.productionBlocked = false;
  governance.blockers = [];

  const approvedArtifacts = {
    "trust/privacy.html": "<!doctype html><title>Privacy</title><main>Example Operator LLC privacy@example.com approved privacy notice</main>",
    "trust/terms.html": "<!doctype html><title>Terms</title><main>Example Operator LLC legal@example.com COUNSEL-2026-001 approved terms</main>",
    "trust/accessibility.html": "<!doctype html><title>Accessibility</title><main>Example Operator LLC accessibility@example.com approved accessibility statement</main>",
    "trust/security.html": "<!doctype html><title>Security</title><main>Example Operator LLC security@example.com approved security statement</main>",
    "trust/sources.html": "<!doctype html><title>Sources</title><main>Example Operator LLC RIGHTS-2026-001 approved source methodology</main>",
    "trust/corrections.html": "<!doctype html><title>Corrections</title><main>Example Operator LLC corrections@example.com approved correction policy</main>",
    "public/.well-known/security.txt": "Contact: mailto:security@example.com\nExpires: 2027-08-09T00:00:00.000Z\nPolicy: https://example.com/security\n",
  };
  governance.approvedArtifactSha256 = Object.fromEntries(
    Object.entries(approvedArtifacts).map(([relativePath, contents]) => [
      relativePath,
      createHash("sha256").update(contents).digest("hex"),
    ])
  );

  const content = await readJson("config/content-status.json");
  content.corpus.status = "active";

  await Promise.all([
    writeFile(path.join(root, "config/source-version.json"), JSON.stringify(source)),
    writeFile(path.join(root, "config/release-governance.json"), JSON.stringify(governance)),
    writeFile(path.join(root, "config/content-status.json"), JSON.stringify(content)),
    writeFile(path.join(root, "compliance/private/source.pdf"), verifiedSource),
    ...Object.entries(approvedArtifacts).map(([relativePath, contents]) =>
      writeFile(path.join(root, relativePath), contents)
    ),
  ]);

  const now = new Date("2026-08-09T00:00:00.000Z");
  const result = await validateRelease({ root, mode: "production", now });
  assert.equal(result.releaseId, "2026-08-approved");

  await writeFile(path.join(root, "trust/privacy.html"), "PRE-RELEASE PLACEHOLDER");
  await assert.rejects(
    validateRelease({ root, mode: "production", now }),
    /trust\/privacy\.html does not match its approved bytes/
  );
});

test("corpus checksum drift fails before release", async () => {
  const root = await createFixture();
  const sourcePath = path.join(root, "config/source-version.json");
  const source = JSON.parse(await readFile(sourcePath, "utf8"));
  source.corpus.sha256 = "0".repeat(64);
  await writeFile(sourcePath, JSON.stringify(source));

  await assert.rejects(validateRelease({ root, mode: "draft" }), /checksum does not match/);
});

test("production rejects placeholder governance facts", async () => {
  const root = await createFixture();
  const governancePath = path.join(root, "config/release-governance.json");
  const governance = JSON.parse(await readFile(governancePath, "utf8"));
  governance.releaseMode = "production";
  governance.productionBlocked = false;
  governance.blockers = [];
  governance.releaseId = "2026-08-candidate";
  governance.operator = { legalName: "TBD operator", contact: "legal@example.invalid" };
  await writeFile(governancePath, JSON.stringify(governance));

  await assert.rejects(
    validateRelease({ root, mode: "production" }),
    /operator legal name must not be a placeholder/
  );
});

test("emergency-disabled content cannot remain enabled", async () => {
  const root = await createFixture();
  const statusPath = path.join(root, "config/content-status.json");
  const status = JSON.parse(await readFile(statusPath, "utf8"));
  status.corpus.status = "disabled";
  await writeFile(statusPath, JSON.stringify(status));

  await assert.rejects(validateRelease({ root, mode: "draft" }), /disabled content must not be enabled/);
});

const withEnrichment = async () => {
  const root = await createFixture();
  await mkdir(path.join(root, "src", "data", "enrichment"), { recursive: true });
  for (const relativePath of ["config/enrichment-version.json", "src/data/enrichment/citation-model.json"]) {
    await writeFile(path.join(root, relativePath), await readFile(path.join(ROOT, relativePath)));
  }
  return root;
};

test("the enrichment layer is optional but must agree with the shipped corpus", async () => {
  // Absent enrichment is a valid release: the interface degrades to the frozen corpus.
  const bare = await createFixture();
  assert.equal((await validateRelease({ root: bare, mode: "draft" })).records, 953);

  const root = await withEnrichment();
  assert.equal((await validateRelease({ root, mode: "draft" })).records, 953);

  const manifestPath = path.join(root, "config/enrichment-version.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.corpusRef.sha256 = "f".repeat(64);
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  await assert.rejects(
    validateRelease({ root, mode: "draft" }),
    /enrichment manifest references a different corpus/
  );
});

test("the enrichment layer cannot introduce a record the corpus does not contain", async () => {
  const root = await withEnrichment();
  const modelPath = path.join(root, "src/data/enrichment/citation-model.json");
  const model = JSON.parse(await readFile(modelPath, "utf8"));

  delete model.records["offense-0001"];
  model.records["offense-9999"] = { resolution: "parsed", citation: "625 ILCS 5/1-100" };
  await writeFile(modelPath, JSON.stringify(model));

  await assert.rejects(
    validateRelease({ root, mode: "draft" }),
    /references a record not in the corpus: offense-9999/
  );
});

test("a claimed human review must be backed by a review log", async () => {
  // Automated retrieval is not review. Raising this count without a recorded sign-off
  // would let generated content inherit an authority nobody granted it.
  const root = await withEnrichment();
  const manifestPath = path.join(root, "config/enrichment-version.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  assert.equal(manifest.review.humanReviewedRecordCount, 0);
  manifest.review.humanReviewedRecordCount = 40;
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  await assert.rejects(validateRelease({ root, mode: "draft" }), /requires a review log/);
});

test("the enrichment layer must disclaim government affiliation", async () => {
  const root = await withEnrichment();
  const manifestPath = path.join(root, "config/enrichment-version.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  manifest.affiliation.status = "endorsed";
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  await assert.rejects(validateRelease({ root, mode: "draft" }), /must disclaim government affiliation/);
});
