import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHA256 = /^[a-f0-9]{64}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CONTENT_STATUSES = new Set(["active", "review-due", "superseded", "disabled"]);
const TRUST_ARTIFACTS = [
  "trust/privacy.html",
  "trust/terms.html",
  "trust/accessibility.html",
  "trust/security.html",
  "trust/sources.html",
  "trust/corrections.html",
  "public/.well-known/security.txt",
];

const readJson = async (root, relativePath) =>
  JSON.parse(await readFile(path.join(root, relativePath), "utf8"));

/** Optional artifacts: absent is valid, malformed is not. */
const readJsonIfPresent = async (root, relativePath) => {
  let contents;
  try {
    contents = await readFile(path.join(root, relativePath), "utf8");
  } catch {
    return null;
  }
  return relativePath.endsWith(".ndjson") ? contents : JSON.parse(contents);
};

const sha256 = (contents) => createHash("sha256").update(contents).digest("hex");

const requireText = (value, label) => {
  assert.equal(typeof value, "string", `${label} must be a string`);
  assert.ok(value.trim(), `${label} must not be blank`);
  assert.ok(!/pending|placeholder|tbd|draft/i.test(value), `${label} must not be a placeholder`);
};

const requireApproval = (approval, label) => {
  assert.ok(
    approval?.status === "approved" || approval?.status === "owner-attested",
    `${label} must be approved or owner-attested`
  );
  requireText(approval.reference, `${label} reference`);
  assert.match(approval.approvedAt ?? "", ISO_DATE, `${label} approval date must be YYYY-MM-DD`);
};

const requireLegalReviewDisposition = (approval) => {
  assert.ok(
    approval?.status === "approved" || approval?.status === "not-obtained",
    "counsel review must be approved or explicitly recorded as not obtained"
  );
  requireText(approval.reference, "counsel review reference");
  assert.match(approval.approvedAt ?? "", ISO_DATE, "counsel review disposition date must be YYYY-MM-DD");
};

const requireDate = (value, label) => {
  assert.match(value ?? "", ISO_DATE, `${label} must be YYYY-MM-DD`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  assert.equal(parsed.toISOString().slice(0, 10), value, `${label} must be a real calendar date`);
};

const requireApprovedArtifact = (contents, label, requiredValues = []) => {
  assert.ok(
    !/pre-release|\bdraft\b|placeholder|not monitored|example\.invalid|approval required/i.test(contents),
    `${label} still contains draft or unmonitored placeholder language`
  );
  requiredValues.forEach((value) => {
    requireText(value, `${label} required value`);
    assert.ok(contents.includes(value), `${label} must publish its approved operator/contact value`);
  });
};

const requireHtmlArtifact = (contents, label) => {
  assert.match(contents, /^<!doctype html>/i, `${label} must be a complete HTML document`);
  assert.match(contents, /<title>[^<]+<\/title>/i, `${label} must have a non-empty title`);
  assert.match(contents, /<main(?:\s|>)/i, `${label} must have a main landmark`);
};

const requireSecurityText = (contents, now) => {
  assert.match(contents, /^Contact:\s*(?:mailto:|https:\/\/).+/im, "security.txt needs a Contact field");
  assert.match(contents, /^Expires:\s*\d{4}-\d{2}-\d{2}T.+Z$/im, "security.txt needs an expiry");
  assert.match(contents, /^Policy:\s*https:\/\/.+/im, "security.txt needs an HTTPS policy URL");
  const expiry = contents.match(/^Expires:\s*(.+)$/im)?.[1]?.trim();
  assert.ok(Date.parse(expiry) > now.getTime(), "security.txt expiry must be in the future");
};

export async function validateRelease({ root = SCRIPT_ROOT, mode = "draft", now = new Date() } = {}) {
  assert.ok(mode === "draft" || mode === "production", "mode must be draft or production");

  const [source, governance, content, packageJson] = await Promise.all([
    readJson(root, "config/source-version.json"),
    readJson(root, "config/release-governance.json"),
    readJson(root, "config/content-status.json"),
    readJson(root, "package.json"),
  ]);
  const corpusPath = path.resolve(root, source.corpus?.path ?? "");
  assert.ok(corpusPath.startsWith(`${path.resolve(root)}${path.sep}`), "corpus path must stay inside the project");
  const corpusBytes = await readFile(corpusPath);
  const corpus = JSON.parse(corpusBytes.toString("utf8"));

  assert.equal(source.schemaVersion, 1, "unsupported source manifest schema");
  assert.equal(governance.schemaVersion, 1, "unsupported governance manifest schema");
  assert.equal(content.schemaVersion, 1, "unsupported content status schema");
  assert.match(source.corpus.sha256 ?? "", SHA256, "corpus checksum must be SHA-256");
  assert.equal(sha256(corpusBytes), source.corpus.sha256, "corpus checksum does not match the shipped data");
  assert.equal(source.corpus.recordCount, 953, "source manifest must require 953 records");
  assert.equal(corpus.offenses.length, 953, "corpus must contain exactly 953 records");
  assert.equal(corpus.meta.offenseEntries, 953, "corpus metadata must declare 953 records");
  assert.equal(corpus.meta.sourcePages, source.corpus.sourcePageCount, "source page-count metadata must agree");

  const ids = new Set();
  const linkedPages = [];
  for (const offense of corpus.offenses) {
    assert.ok(offense.id && !ids.has(offense.id), `offense IDs must be present and unique: ${offense.id ?? "missing"}`);
    ids.add(offense.id);
    assert.ok(
      Number.isInteger(offense.page) &&
        offense.page >= source.corpus.recordPageRange.first &&
        offense.page <= source.corpus.recordPageRange.last &&
        offense.page <= source.corpus.sourcePageCount,
      `${offense.id} must link to a valid declared source page`
    );
    linkedPages.push(offense.page);
  }
  assert.equal(Math.min(...linkedPages), source.corpus.recordPageRange.first, "first linked source page must match the manifest");
  assert.equal(Math.max(...linkedPages), source.corpus.recordPageRange.last, "last linked source page must match the manifest");

  assert.equal(content.app.version, packageJson.version, "app version must match package.json");
  assert.equal(content.corpus.version, source.corpus.version, "corpus versions must agree");
  assert.equal(content.corpus.sourceVersionId, source.id, "content status must reference the source manifest");
  assert.ok(CONTENT_STATUSES.has(content.corpus.status), "content status is unsupported");
  assert.equal(content.emergencyControl?.supported, true, "emergency disabling must be supported");
  assert.equal(content.emergencyControl?.disabledStatus, "disabled", "emergency disabled status must be explicit");
  requireText(content.emergencyControl?.publicMessage, "emergency public message");
  assert.equal(
    content.corpus.enabled,
    content.corpus.status !== "disabled",
    "disabled content must not be enabled, and enabled content must not be disabled"
  );

  // Statutory enrichment is an optional layer joined to the frozen corpus. It may be
  // absent entirely, but when present it must not contradict the corpus or overstate
  // what has actually been reviewed.
  const enrichment = await readJsonIfPresent(root, "config/enrichment-version.json");
  if (enrichment) {
    assert.equal(enrichment.schemaVersion, 1, "unsupported enrichment manifest schema");
    assert.equal(
      enrichment.corpusRef?.sha256,
      source.corpus.sha256,
      "enrichment manifest references a different corpus than the one shipped"
    );
    assert.equal(enrichment.corpusRef?.recordCount, 953, "enrichment manifest must reference 953 records");
    assert.match(enrichment.ilga?.urlTemplate ?? "", /^https:\/\/www\.ilga\.gov\//, "ILGA template must be an official https URL");
    assert.ok(enrichment.ilga.urlTemplate.includes("{docName}"), "ILGA template must carry a document placeholder");

    // The project must never imply government affiliation it does not have.
    assert.equal(enrichment.affiliation?.status, "none", "enrichment manifest must disclaim government affiliation");
    requireText(enrichment.affiliation?.statement, "affiliation statement");

    const model = await readJsonIfPresent(root, "src/data/enrichment/citation-model.json");
    if (model) {
      assert.equal(
        model.generatedFrom?.corpusSha256,
        source.corpus.sha256,
        "citation model was generated from a different corpus than the one shipped"
      );
      const modelIds = Object.keys(model.records ?? {});
      assert.equal(modelIds.length, 953, "citation model must cover exactly the 953 corpus records");
      // The enrichment layer can annotate records; it can never introduce a 954th.
      for (const id of modelIds) {
        assert.ok(ids.has(id), `citation model references a record not in the corpus: ${id}`);
      }
    }

    // No record is human-reviewed yet. If that ever changes, it changes through a
    // recorded review, not by editing this number.
    const reviewed = enrichment.review?.humanReviewedRecordCount;
    assert.ok(Number.isInteger(reviewed) && reviewed >= 0, "enrichment must declare a human-reviewed record count");
    if (reviewed > 0) {
      const reviewLog = await readJsonIfPresent(root, "content/review-log.ndjson");
      assert.ok(reviewLog, "a non-zero human-reviewed count requires a review log");
    }
  }

  if (mode === "production") {
    assert.equal(governance.releaseMode, "production", "production release mode is required");
    assert.equal(governance.productionBlocked, false, "production release must be explicitly unblocked");
    assert.deepEqual(governance.blockers, [], "production release must have no declared blockers");
    requireText(governance.releaseId, "release ID");
    requireText(governance.operator?.legalName, "operator legal name");
    requireText(governance.operator?.contact, "operator contact");
    for (const [owner, value] of Object.entries(governance.owners ?? {})) {
      requireText(value, `${owner} owner`);
    }
    assert.deepEqual(
      Object.keys(governance.owners ?? {}).sort(),
      ["accessibility", "content", "privacy", "security"],
      "all accountable owners are required"
    );
    assert.deepEqual(
      Object.keys(governance.contacts ?? {}).sort(),
      ["accessibility", "privacy", "security"],
      "all monitored role contacts are required"
    );
    for (const [contactName, value] of Object.entries(governance.contacts ?? {})) {
      requireText(value, `${contactName} contact`);
    }
    for (const [approvalName, approval] of Object.entries(governance.approvals ?? {})) {
      if (approvalName === "counsel") requireLegalReviewDisposition(approval);
      else requireApproval(approval, approvalName);
    }
    assert.deepEqual(
      Object.keys(governance.approvals ?? {}).sort(),
      ["accessibility", "content", "counsel", "securityPrivacy", "sourceRights"].sort(),
      "all release approvals are required"
    );
    requireText(governance.corrections?.contact, "corrections contact");
    assert.ok(
      Number.isInteger(governance.corrections?.responseSlaBusinessDays) &&
        governance.corrections.responseSlaBusinessDays > 0,
      "corrections SLA must be a positive number of business days"
    );
    requireDate(source.retrievedDate, "source retrieval date");
    if (source.sourceArtifact?.hashStatus === "verified") {
      assert.match(source.sourceArtifact?.sha256 ?? "", SHA256, "verified source artifact SHA-256 is required");
      requireText(source.sourceArtifact?.verificationPath, "source artifact verification path");
      const sourceArtifactPath = path.resolve(root, source.sourceArtifact.verificationPath);
      assert.ok(
        sourceArtifactPath.startsWith(`${path.resolve(root)}${path.sep}`),
        "source artifact verification path must stay inside the project"
      );
      const sourceArtifactBytes = await readFile(sourceArtifactPath);
      assert.ok(sourceArtifactBytes.byteLength >= 1024, "source artifact verification file is implausibly small");
      assert.equal(
        sourceArtifactBytes.subarray(0, 5).toString("ascii"),
        "%PDF-",
        "source artifact verification file must be a PDF"
      );
      assert.equal(
        sha256(sourceArtifactBytes),
        source.sourceArtifact.sha256,
        "source artifact checksum does not match the verified file"
      );
    } else {
      assert.equal(
        source.sourceArtifact?.hashStatus,
        "not-independently-verified",
        "unhashed source artifacts must explicitly disclose missing independent verification"
      );
      assert.equal(source.sourceArtifact?.sha256, null, "an unverified source artifact must not claim a checksum");
      assert.equal(source.sourceArtifact?.verificationPath, null, "an unverified source artifact must not claim a local file");
      assert.match(source.canonicalUrl ?? "", /^https:\/\/www\.ilsos\.gov\//, "source must use the official SOS URL");
    }
    assert.ok(
      source.rights?.status === "approved" || source.rights?.status === "owner-attested-public-source-use",
      "source use basis must be approved or owner-attested"
    );
    requireText(source.rights?.approvalReference, "source-rights approval reference");
    assert.equal(source.review?.status, "active", "production source review must be active");
    requireDate(source.review?.lastReviewedDate, "last review date");
    requireDate(source.review?.nextReviewDate, "next review date");
    assert.ok(source.review.nextReviewDate > source.review.lastReviewedDate, "next review must follow the last review");
    assert.ok(
      source.review.nextReviewDate >= now.toISOString().slice(0, 10),
      "next review date must not already be expired"
    );
    assert.equal(content.corpus.status, "active", "production corpus must be active");
    assert.equal(content.corpus.enabled, true, "production corpus must be enabled");

    const artifacts = await Promise.all(
      TRUST_ARTIFACTS.map(async (relativePath) => [
        relativePath,
        await readFile(path.join(root, relativePath), "utf8"),
      ])
    );
    const artifactMap = new Map(artifacts);
    assert.deepEqual(
      Object.keys(governance.approvedArtifactSha256 ?? {}).sort(),
      [...TRUST_ARTIFACTS].sort(),
      "every shipped trust artifact needs an approved checksum"
    );
    artifacts.forEach(([relativePath, contents]) => {
      const approvedHash = governance.approvedArtifactSha256[relativePath];
      assert.match(approvedHash ?? "", SHA256, `${relativePath} needs an approved SHA-256`);
      assert.equal(
        sha256(Buffer.from(contents, "utf8")),
        approvedHash,
        `${relativePath} does not match its approved bytes`
      );
      if (relativePath.endsWith(".html")) requireHtmlArtifact(contents, relativePath);
      else requireSecurityText(contents, now);
    });
    requireApprovedArtifact(artifactMap.get("trust/privacy.html"), "privacy notice", [
      governance.operator.legalName,
      governance.contacts.privacy,
    ]);
    requireApprovedArtifact(artifactMap.get("trust/terms.html"), "terms", [
      governance.operator.legalName,
      governance.operator.contact,
      governance.approvals.counsel.reference,
    ]);
    requireApprovedArtifact(artifactMap.get("trust/accessibility.html"), "accessibility statement", [
      governance.operator.legalName,
      governance.contacts.accessibility,
    ]);
    requireApprovedArtifact(artifactMap.get("trust/security.html"), "security statement", [
      governance.operator.legalName,
      governance.contacts.security,
    ]);
    requireApprovedArtifact(artifactMap.get("trust/sources.html"), "source methodology", [
      governance.operator.legalName,
      source.rights.approvalReference,
    ]);
    requireApprovedArtifact(artifactMap.get("trust/corrections.html"), "correction policy", [
      governance.operator.legalName,
      governance.corrections.contact,
    ]);
    requireApprovedArtifact(artifactMap.get("public/.well-known/security.txt"), "security.txt", [
      governance.contacts.security,
    ]);
  }

  return { mode, releaseId: governance.releaseId, records: corpus.offenses.length };
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const modeArg = process.argv.find((argument) => argument.startsWith("--mode="));
  const mode = modeArg?.slice("--mode=".length) || "draft";
  try {
    const result = await validateRelease({ mode });
    console.log(`Validated ${result.records} records and ${result.mode} release governance (${result.releaseId}).`);
  } catch (error) {
    console.error(`Release validation failed: ${error.message}`);
    process.exitCode = 1;
  }
}
