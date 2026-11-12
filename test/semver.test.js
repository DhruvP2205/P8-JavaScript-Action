const test = require("node:test");
const assert = require("node:assert");
const { parseVersion } = require("../src/semver");

// parseVersion(input, options) returns:
//   { valid, version, major, minor, patch, prerelease, dockerTags, reason }
//   - valid:       boolean
//   - version:     normalized string without a leading "v" and without build metadata ("" if invalid)
//   - major/minor/patch: numbers (null if invalid)
//   - prerelease:  string, "" when there is none
//   - dockerTags:  array of strings, [] if invalid
//   - reason:      non-empty string explaining the problem when invalid, "" when valid
// options: { allowPrefixV } (default true)

test("stable version produces full, minor and major tags", () => {
  const r = parseVersion("1.2.3");
  assert.strictEqual(r.valid, true);
  assert.strictEqual(r.version, "1.2.3");
  assert.deepStrictEqual([r.major, r.minor, r.patch], [1, 2, 3]);
  assert.strictEqual(r.prerelease, "");
  assert.deepStrictEqual(r.dockerTags, ["1.2.3", "1.2", "1"]);
  assert.strictEqual(r.reason, "");
});

test("a leading lowercase v is accepted by default and removed", () => {
  const r = parseVersion("v1.1.0");
  assert.strictEqual(r.valid, true);
  assert.strictEqual(r.version, "1.1.0");
  assert.deepStrictEqual(r.dockerTags, ["1.1.0", "1.1", "1"]);
});

test("a leading v is rejected when allowPrefixV is false", () => {
  const r = parseVersion("v1.1.0", { allowPrefixV: false });
  assert.strictEqual(r.valid, false);
  assert.ok(r.reason.length > 0);
});

test("an uppercase V is never accepted", () => {
  assert.strictEqual(parseVersion("V1.2.3").valid, false);
});

test("surrounding whitespace is trimmed", () => {
  const r = parseVersion("  1.2.3  ");
  assert.strictEqual(r.valid, true);
  assert.strictEqual(r.version, "1.2.3");
});

test("a prerelease only gets its own full tag, never the moving ones", () => {
  const r = parseVersion("1.0.0-rc.1");
  assert.strictEqual(r.valid, true);
  assert.strictEqual(r.prerelease, "rc.1");
  assert.deepStrictEqual(r.dockerTags, ["1.0.0-rc.1"]);
});

test("build metadata is ignored and never appears in tags", () => {
  const r = parseVersion("1.0.0+build.5");
  assert.strictEqual(r.valid, true);
  assert.strictEqual(r.version, "1.0.0");
  assert.deepStrictEqual(r.dockerTags, ["1.0.0", "1.0", "1"]);
});

test("prerelease plus build metadata keeps only the prerelease", () => {
  const r = parseVersion("1.0.0-rc.1+build.5");
  assert.strictEqual(r.valid, true);
  assert.strictEqual(r.version, "1.0.0-rc.1");
  assert.deepStrictEqual(r.dockerTags, ["1.0.0-rc.1"]);
});

test("0.x versions get no bare major tag, because 0 promises no stability", () => {
  const r = parseVersion("0.4.2");
  assert.strictEqual(r.valid, true);
  assert.deepStrictEqual(r.dockerTags, ["0.4.2", "0.4"]);
});

test("valid prerelease identifiers from the semver spec", () => {
  for (const v of ["1.0.0-alpha", "1.0.0-alpha.1", "1.0.0-0.3.7", "1.0.0-x.7.z.92", "1.0.0-alpha-beta"]) {
    assert.strictEqual(parseVersion(v).valid, true, v);
  }
});

test("numeric parts must not have leading zeros", () => {
  for (const v of ["01.2.3", "1.02.3", "1.2.03", "1.0.0-01", "1.0.0-alpha.01"]) {
    assert.strictEqual(parseVersion(v).valid, false, v);
  }
});

test("incomplete or malformed versions are invalid, with a reason", () => {
  for (const v of ["1", "1.2", "1.2.3.4", "a.b.c", "1.2.3-", "1.2.3+", "-1.2.3", "1..3", ""]) {
    const r = parseVersion(v);
    assert.strictEqual(r.valid, false, v);
    assert.ok(r.reason.length > 0, v);
    assert.deepStrictEqual(r.dockerTags, [], v);
    assert.strictEqual(r.major, null, v);
  }
});

test("non-string input is invalid and does not throw", () => {
  for (const v of [undefined, null, 123, {}, []]) {
    const r = parseVersion(v);
    assert.strictEqual(r.valid, false);
    assert.ok(r.reason.length > 0);
  }
});
