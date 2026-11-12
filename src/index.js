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

  // 4. Validate SemVer format, optional prerelease and build metadata
  const semverRegex = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([\w.-]+))?(?:\+([\w.-]+))?$/;
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

  const majorStr = match[1];
  const minorStr = match[2];
  const patchStr = match[3];
  const prerelease = match[4] || "";
  const build = match[5] || "";

  // 5. Validate that numeric pre-release identifiers do not have leading zeros (e.g., "-01")
  if (prerelease) {
    const identifiers = prerelease.split('.');
    for (const id of identifiers) {
      if (/^\d+$/.test(id) && id.length > 1 && id.startsWith('0')) {
        return {
          valid: false,
          version: "",
          major: null,
          minor: null,
          patch: null,
          prerelease: "",
          dockerTags: [],
          reason: "Numeric pre-release identifiers must not include leading zeros."
        };
      }
    }
  }

  const major = parseInt(majorStr, 10);
  const minor = parseInt(minorStr, 10);
  const patch = parseInt(patchStr, 10);

  // The normalized version string without a leading "v" and without build metadata
  const versionWithoutBuild = `${major}.${minor}.${patch}${prerelease ? '-' + prerelease : ''}`;

  // 6. Build dockerTags list
  const dockerTags = [versionWithoutBuild];

  // A stable release means there is no prerelease component
  const isStable = !prerelease;

  if (isStable) {
    // Add major.minor
    dockerTags.push(`${major}.${minor}`);

    // Add major-only ONLY if major > 0 (no bare 0 for 0.x versions)
    if (major > 0) {
      dockerTags.push(`${major}`);
    }
  }

  return {
    valid: true,
    version: versionWithoutBuild,
    major,
    minor,
    patch,
    prerelease,
    dockerTags,
    reason: ""
  };
}