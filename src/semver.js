/**
 * Parses, validates, and extracts SemVer components and tags from an input.
 * 
 * @param {any} input - The version input to parse (must be text).
 * @param {Object} [options={}] - Configuration options.
 * @param {boolean} [options.allowPrefixV=true] - Whether a lowercase leading 'v' is allowed and removed.
 * @returns {Object} Result object matching test suite specifications.
 */
export function parseVersion(input, options = {}) {
  // 1. Reject anything that isn’t a string (non-string input is invalid and does not throw)
  if (typeof input !== "string" && !(input instanceof String)) {
    return {
      valid: false,
      version: "",
      major: null,
      minor: null,
      patch: null,
      prerelease: "",
      dockerTags: [],
      reason: "Input must be a string."
    };
  }

  // 2. Surrounding whitespace is trimmed
  let processed = String(input).trim();

  // 3. Handle allowPrefixV option (default is true)
  const allowPrefixV = options.allowPrefixV !== false;

  // Uppercase 'V' is NEVER accepted anywhere
  if (processed.startsWith("V")) {
    return {
      valid: false,
      version: "",
      major: null,
      minor: null,
      patch: null,
      prerelease: "",
      dockerTags: [],
      reason: "Uppercase 'V' prefix is not allowed."
    };
  }

  // Check for lowercase 'v' prefix
  const hasVPrefix = processed.startsWith("v");
  if (hasVPrefix) {
    if (!allowPrefixV) {
      return {
        valid: false,
        version: "",
        major: null,
        minor: null,
        patch: null,
        prerelease: "",
        dockerTags: [],
        reason: "Leading 'v' prefix is not allowed when allowPrefixV is false."
      };
    }
    // Remove the leading 'v' if allowed
    processed = processed.slice(1);
  }

  // 4. Validate SemVer format, no leading zeros, optional prerelease and build metadata
  // Segments: (0|[1-9]\d*)
  const semverRegex = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([\w.-]+))?$/;
  const match = processed.match(semverRegex);

  if (!match) {
    return {
      valid: false,
      version: "",
      major: null,
      minor: null,
      patch: null,
      prerelease: "",
      dockerTags: [],
      reason: "Invalid version format, malformed identifiers, or leading zero detected."
    };
  }

  // 5. Extract components
  const majorNum = parseInt(match[1], 10);
  const minorNum = parseInt(match[2], 10);
  const patchNum = parseInt(match[3], 10);
  const prerelease = match[4] || "";
  const build = match[5] || "";

  // The normalized version string without a leading "v" and without build metadata
  const versionWithoutBuild = `${majorNum}.${minorNum}.${patchNum}${prerelease ? '-' + prerelease : ''}`;

  // 6. Build dockerTags list
  const dockerTags = [];
  dockerTags.push(versionWithoutBuild);

  // A stable release means there is no prerelease component
  const isStable = !prerelease;

  if (isStable) {
    // Add major.minor
    dockerTags.push(`${majorNum}.${minorNum}`);

    // Add major-only ONLY if major > 0 (no bare 0 for 0.x versions)
    if (majorNum > 0) {
      dockerTags.push(`${majorNum}`);
    }
  }

  return {
    valid: true,
    version: versionWithoutBuild,
    major: majorNum,
    minor: minorNum,
    patch: patchNum,
    prerelease,
    dockerTags,
    reason: ""
  };
}