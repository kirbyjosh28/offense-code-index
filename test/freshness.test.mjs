import test from "node:test";
import assert from "node:assert/strict";
import { createBuildId } from "../scripts/build-version.mjs";
import {
  createFreshnessMonitor,
  fetchBuildVersion,
  isBuildId,
} from "../src/freshness.js";

const CURRENT_BUILD = "111111111111";
const NEXT_BUILD = "222222222222";

test("build identifiers are deterministic content hashes", () => {
  const inputs = [["app.js", "const ready = true;"]];
  assert.equal(createBuildId(inputs), createBuildId(inputs));
  assert.notEqual(createBuildId(inputs), createBuildId([["app.js", "const ready = false;"]]));
  assert.match(createBuildId(inputs), /^[a-f0-9]{12}$/);
});

test("build identifier validation rejects development and malformed values", () => {
  assert.equal(isBuildId(CURRENT_BUILD), true);
  assert.equal(isBuildId("dev"), false);
  assert.equal(isBuildId("ABCDEF123456"), false);
  assert.equal(isBuildId("123"), false);
});

test("matching builds remain quiet", async () => {
  const updates = [];
  const monitor = createFreshnessMonitor({
    currentBuild: CURRENT_BUILD,
    fetchBuild: async () => CURRENT_BUILD,
    onUpdate: (build) => updates.push(build),
  });

  assert.equal(await monitor.check({ force: true }), null);
  assert.deepEqual(updates, []);
});

test("a newer build is announced once and checks are throttled", async () => {
  let clock = 0;
  let requests = 0;
  const updates = [];
  const monitor = createFreshnessMonitor({
    currentBuild: CURRENT_BUILD,
    fetchBuild: async () => {
      requests += 1;
      return NEXT_BUILD;
    },
    onUpdate: (build) => updates.push(build),
    now: () => clock,
  });

  assert.equal(await monitor.check({ force: true }), NEXT_BUILD);
  clock = 1000;
  assert.equal(await monitor.check(), null);
  clock = 61_000;
  assert.equal(await monitor.check(), null);
  assert.equal(requests, 2);
  assert.deepEqual(updates, [NEXT_BUILD]);
});

test("concurrent checks share one in-flight request", async () => {
  let resolveRequest;
  let requests = 0;
  const monitor = createFreshnessMonitor({
    currentBuild: CURRENT_BUILD,
    fetchBuild: () => {
      requests += 1;
      return new Promise((resolve) => {
        resolveRequest = resolve;
      });
    },
  });

  const first = monitor.check({ force: true });
  const second = monitor.check({ force: true });
  assert.strictEqual(first, second);
  await Promise.resolve();
  resolveRequest(NEXT_BUILD);
  assert.equal(await first, NEXT_BUILD);
  assert.equal(requests, 1);
});

test("session-suppressed builds remain quiet", async () => {
  let announced = false;
  const monitor = createFreshnessMonitor({
    currentBuild: CURRENT_BUILD,
    fetchBuild: async () => NEXT_BUILD,
    isSuppressed: (build) => build === NEXT_BUILD,
    onUpdate: () => {
      announced = true;
    },
  });

  assert.equal(await monitor.check({ force: true }), null);
  assert.equal(announced, false);
});

test("malformed and failed version checks never escape into the app", async () => {
  for (const fetchBuild of [async () => "invalid", async () => null, async () => {
    throw new Error("offline");
  }]) {
    const monitor = createFreshnessMonitor({
      currentBuild: CURRENT_BUILD,
      fetchBuild,
      onUpdate: () => assert.fail("invalid checks must not announce an update"),
    });
    assert.equal(await monitor.check({ force: true }), null);
  }
});

test("version requests require a valid response and disable caching", async () => {
  let requestOptions;
  const build = await fetchBuildVersion({
    fetchImpl: async (_url, options) => {
      requestOptions = options;
      return { ok: true, json: async () => ({ build: NEXT_BUILD }) };
    },
  });

  assert.equal(build, NEXT_BUILD);
  assert.equal(requestOptions.cache, "no-store");
  assert.equal(requestOptions.headers["Cache-Control"], "no-cache");
  assert.ok(requestOptions.signal instanceof AbortSignal);

  const malformed = await fetchBuildVersion({
    fetchImpl: async () => ({ ok: true, json: async () => ({ build: "latest" }) }),
  });
  assert.equal(malformed, null);
});

test("timed-out version requests fail silently", async () => {
  const build = await fetchBuildVersion({
    timeoutMs: 0,
    fetchImpl: async (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      }),
  });
  assert.equal(build, null);
});
