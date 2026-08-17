const BUILD_ID_PATTERN = /^[a-f0-9]{12}$/;

export const isBuildId = (value) =>
  typeof value === "string" && BUILD_ID_PATTERN.test(value);

export const fetchBuildVersion = async ({
  fetchImpl = globalThis.fetch,
  url = "./version.json",
  timeoutMs = 3000,
  setTimer = globalThis.setTimeout,
  clearTimer = globalThis.clearTimeout,
} = {}) => {
  if (typeof fetchImpl !== "function") return null;

  const controller = new AbortController();
  const timeout = setTimer(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
      signal: controller.signal,
    });
    if (!response?.ok) return null;
    const payload = await response.json();
    return isBuildId(payload?.build) ? payload.build : null;
  } catch {
    return null;
  } finally {
    clearTimer(timeout);
  }
};

export const createFreshnessMonitor = ({
  currentBuild,
  fetchBuild,
  onUpdate,
  isSuppressed = () => false,
  now = Date.now,
  throttleMs = 60_000,
}) => {
  let inFlight = null;
  let lastCheckedAt = Number.NEGATIVE_INFINITY;
  let announcedBuild = null;

  const check = ({ force = false } = {}) => {
    if (!isBuildId(currentBuild) || typeof fetchBuild !== "function") {
      return Promise.resolve(null);
    }
    if (inFlight) return inFlight;

    const checkedAt = now();
    if (!force && checkedAt - lastCheckedAt < throttleMs) {
      return Promise.resolve(null);
    }
    lastCheckedAt = checkedAt;

    inFlight = Promise.resolve()
      .then(fetchBuild)
      .then((publishedBuild) => {
        if (
          !isBuildId(publishedBuild) ||
          publishedBuild === currentBuild ||
          publishedBuild === announcedBuild ||
          isSuppressed(publishedBuild)
        ) {
          return null;
        }
        announcedBuild = publishedBuild;
        onUpdate?.(publishedBuild);
        return publishedBuild;
      })
      .catch(() => null)
      .finally(() => {
        inFlight = null;
      });

    return inFlight;
  };

  return { check };
};
