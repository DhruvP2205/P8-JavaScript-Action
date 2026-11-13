// src/semver.js
// Checks whether a text is a valid semantic version (https://semver.org)
// and works out which Docker tags it should produce.
//
// Examples:
//   parseVersion("1.2.3").dockerTags       -> ["1.2.3", "1.2", "1"]
//   parseVersion("v1.0.0-rc.1").dockerTags -> ["1.0.0-rc.1"]
//   parseVersion("1.2").valid              -> false

// A number written without leading zeros: "0", "7", "42" are fine, "01" is not.
const NUMBER = /^(0|[1-9]\d*)$/;

// One dot-separated piece of a prerelease, e.g. "rc", "1", "alpha-beta".
// It is either a number without leading zeros, or text that contains at
// least one letter or hyphen (so "01" is not allowed, but "01a" is).
const PRERELEASE_PIECE = /^(0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)$/;

// One dot-separated piece of build metadata, e.g. "build", "5".
const BUILD_PIECE = /^[0-9A-Za-z-]+$/;

// The result we return when the version is not valid.
function invalid(reason) {
  return {
    valid: false,
    version: "",
    major: null,
    minor: null,
    patch: null,
    prerelease: "",
    dockerTags: [],
    reason,
  };
}

function parseVersion(input, options = {}) {
  // By default a leading "v" is allowed, unless the caller says otherwise.
  const allowPrefixV = options.allowPrefixV !== false;

  // Step 1: the input must be text.
  if (typeof input !== "string") {
    return invalid("The version must be text.");
  }

  // Step 2: remove spaces around it, and remove a leading lowercase "v".
  let text = input.trim();
  if (text.startsWith("v")) {
    if (!allowPrefixV) {
      return invalid("A leading 'v' is not allowed.");
    }
    text = text.slice(1);
  }
  if (text === "") {
    return invalid("The version is empty.");
  }

  // Step 3: cut off build metadata (everything after the first "+").
  // It is checked, but it never ends up in the result.
  const plusIndex = text.indexOf("+");
  if (plusIndex !== -1) {
    const build = text.slice(plusIndex + 1);
    text = text.slice(0, plusIndex);
    if (!build.split(".").every((piece) => BUILD_PIECE.test(piece))) {
      return invalid("The build metadata after '+' is not valid.");
    }
  }

  // Step 4: cut off the prerelease (everything after the first "-").
  // A prerelease can itself contain hyphens ("alpha-beta"), which is why
  // we only cut at the FIRST hyphen.
  let prerelease = "";
  const dashIndex = text.indexOf("-");
  if (dashIndex !== -1) {
    prerelease = text.slice(dashIndex + 1);
    text = text.slice(0, dashIndex);
    if (!prerelease.split(".").every((piece) => PRERELEASE_PIECE.test(piece))) {
      return invalid("The prerelease after '-' is not valid.");
    }
  }

  // Step 5: what is left must be exactly MAJOR.MINOR.PATCH.
  const parts = text.split(".");
  if (parts.length !== 3 || !parts.every((part) => NUMBER.test(part))) {
    return invalid(
      "The version must look like MAJOR.MINOR.PATCH, for example 1.2.3 (no leading zeros)."
    );
  }
  const [major, minor, patch] = parts.map(Number);
  if (![major, minor, patch].every(Number.isSafeInteger)) {
    return invalid("The version numbers are too large.");
  }

  // Step 6: build the normalized version and the Docker tags.
  const version = prerelease
    ? `${major}.${minor}.${patch}-${prerelease}`
    : `${major}.${minor}.${patch}`;

  let dockerTags;
  if (prerelease) {
    // A prerelease only gets its own tag, so it never moves "1" or "1.2".
    dockerTags = [version];
  } else if (major === 0) {
    // 0.x versions make no stability promise, so no bare "0" tag.
    dockerTags = [version, `${major}.${minor}`];
  } else {
    dockerTags = [version, `${major}.${minor}`, `${major}`];
  }

  return { valid: true, version, major, minor, patch, prerelease, dockerTags, reason: "" };
}

module.exports = { parseVersion };