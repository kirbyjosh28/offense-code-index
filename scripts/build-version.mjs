import { createHash } from "node:crypto";

export const createBuildId = (entries) => {
  const hash = createHash("sha256");
  entries.forEach(([name, contents]) => {
    hash.update(name);
    hash.update("\0");
    hash.update(contents);
    hash.update("\0");
  });
  return hash.digest("hex").slice(0, 12);
};
