<div align="center">

# 🏷️ Semver Check Action

### A JavaScript GitHub Action that validates a version string and works out which Docker tags it should produce.

![GitHub Actions](https://img.shields.io/badge/GitHub%20Actions-2088FF?style=for-the-badge&logo=githubactions&logoColor=white)
![Node](https://img.shields.io/badge/Node-24-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Tests](https://img.shields.io/badge/Unit%20tests-13%20passing-brightgreen?style=flat-square)
![Matrix](https://img.shields.io/badge/Action%20matrix-7%20cases-brightgreen?style=flat-square)

</div>

---

## 📖 Definition

A **JavaScript action** is a GitHub Action whose code runs directly on the runner with Node.js, with no container to build or pull. It is described by an `action.yml` file (inputs, outputs, entry point) and a bundled JavaScript file. **Semantic versioning** (semver) is the `MAJOR.MINOR.PATCH` scheme, for example `1.2.3`, with optional prerelease (`-rc.1`) and build metadata (`+build.5`).

This action takes a version string, checks it against the semver rules, and returns the parts plus the list of Docker tags that version should publish. It is meant to sit in front of a `docker/build-push-action` step so a bad version stops the pipeline before an image is pushed with a wrong tag.

**What I built:** the action itself, a unit test suite for the parsing logic, a 7 case matrix workflow that tests the action end to end, and a CI workflow that makes sure the committed `dist/` bundle is never stale.

---

## 🚀 Usage

```yaml
- name: Check version
  id: semver
  uses: DhruvP2205/P8-JavaScript-Action@v1
  with:
    version: v2.3.4

- name: Show result
  run: echo "Tags: ${{ steps.semver.outputs.docker-tags }}"
```

Real output from a run in a **different repository** (not this one), on a GitHub hosted runner:

```
Version: 2.3.4
Major: 2
Minor: 3
Patch: 4
Pre-Release:
Docker Tag: 2.3.4,2.3,2
Job Finished!!!
```

### Inputs

| Input | Required | Default | Description |
|-------|:--------:|:-------:|-------------|
| `version` | yes | none | The version to check, e.g. `1.2.3`, `v1.2.3`, `1.0.0-rc.1` |
| `allow-prefix-v` | no | `"true"` | If `false`, a leading `v` makes the version invalid |
| `fail-on-invalid` | no | `"true"` | If `true`, an invalid version turns the step red. If `false`, the step passes and only `valid` is `false` |

### Outputs

| Output | Example (`v1.2.3`) | Description |
|--------|--------------------|-------------|
| `valid` | `true` | Whether the version is valid |
| `version` | `1.2.3` | Normalized version, no leading `v`, no build metadata |
| `major` | `1` | Major number (empty if invalid) |
| `minor` | `2` | Minor number (empty if invalid) |
| `patch` | `3` | Patch number (empty if invalid) |
| `prerelease` | `rc.1` | Prerelease part, empty if none |
| `docker-tags` | `1.2.3,1.2,1` | Comma separated list of Docker tags (empty if invalid) |

---

## 🏷️ Tag rules (decisions I made)

| Version | Tags produced | Why |
|---------|---------------|-----|
| `1.2.3` | `1.2.3`, `1.2`, `1` | Stable release moves the minor and major tags |
| `v1.2.3` | `1.2.3`, `1.2`, `1` | Leading `v` is accepted and removed (unless `allow-prefix-v` is `false`) |
| `1.0.0-rc.1` | `1.0.0-rc.1` | A prerelease only gets its own tag, so it never moves `1` or `1.2` |
| `0.4.2` | `0.4.2`, `0.4` | `0.x` makes no stability promise, so there is no bare `0` tag |
| `1.0.0+build.5` | `1.0.0` | Build metadata is checked but never appears in a tag |
| `1.2`, `01.2.3`, `abc` | none | Invalid, with a reason in the log |

---

## 🧪 How it is tested

There are three layers, and each one catches something the others cannot.

### 1. Unit tests (13)

`node --test` runs `test/semver.test.js` against the parsing function. It covers prefix handling, whitespace, uppercase `V`, prerelease and build metadata, leading zeros, incomplete versions and non-string input.

### 2. End to end matrix (7 cases)

`.github/workflows/test-action.yml` runs the **real action** (`uses: ./`) once per case, using a matrix. For each case it compares the actual `outcome`, `valid` and `docker-tags` against what that case expects.

| Case | Input | Prefix allowed | Fail on invalid | Expected step | Expected tags |
|------|-------|:--------------:|:---------------:|:-------------:|---------------|
| stable | `1.2.3` | true | true | success | `1.2.3,1.2,1` |
| v prefix allowed | `v1.2.3` | true | true | success | `1.2.3,1.2,1` |
| v prefix not allowed | `v1.2.3` | false | true | failure | none |
| prerelease | `1.0.0-rc.1` | true | true | success | `1.0.0-rc.1` |
| zero major | `0.4.2` | true | true | success | `0.4.2,0.4` |
| invalid, fail off | `1.2` | true | false | success | none |
| invalid, fail on | `1.2` | true | true | failure | none |

Two details that matter:

- The action step uses `continue-on-error: true`, and the comparison reads `steps.<id>.outcome`. `outcome` is the real result of the step, while `conclusion` is always `success` once `continue-on-error` has been applied. That is how a case that is *supposed* to fail can still be checked.
- `fail-fast: false`, so one bad case does not hide the others.

### 3. Proof that the matrix can fail

A test that has never failed is not proof of anything. I changed one expected tag value on purpose and the matrix went red:

> 📸 _Screenshot: red run, stable case, with the `docker-tags differ: expected ..., got ...` line_

Then I restored it and all 7 cases went green:

> 📸 _Screenshot: green run, 7 of 7_

---

## 📦 Why `dist/` is committed, and how CI guards it

A JavaScript action runs the file named in `action.yml` (`dist/index.js`) straight from the repository. The consuming workflow does **not** run `npm install`, so the action's dependency (`@actions/core`) must already be inside that file. I bundle everything into one file with `@vercel/ncc`.

The risk is a stale bundle: change `src/`, forget to rebuild, and consumers run old code. `.github/workflows/ci.yml` prevents that:

1. Check out, set up Node 24, `npm ci`
2. `npm test`
3. Rebuild with `npx ncc build src/index.js -o dist`
4. Fail if git says anything under `dist/` changed

```bash
if [ -n "$(git status --porcelain dist)" ]; then
    echo "dist is out of date, rebuild and commit it"
    git status --porcelain dist
    exit 1
fi
```

**Why `git status --porcelain` and not `git diff --exit-code`:** I tested both in a throwaway repo. `git diff --exit-code` fails when a tracked file changes but says nothing about a brand new file, and ncc can create new files. `git status --porcelain` lists both, but its exit code is always 0, so the check has to test whether it printed anything.

### 🐛 The bug this check found: Windows and Linux builds are not identical

My first CI run failed with `441 insertions, 441 deletions` on `dist/index.js`, even though I had just built and committed it.

- First suspect was line endings (CRLF vs LF). I added `.gitattributes` (`dist/** text eol=lf`). `git ls-files --eol` then showed `i/lf w/lf` in CI, and the run **still failed**, so that was not the cause.
- Printing the diff showed the real cause: the code was the same, but the numeric module IDs that ncc (webpack) assigns were different, for example `/***/ 3782:` versus `/***/ 770:`. The build made on my Windows laptop numbers modules differently from the build on the Linux runner.
- Fix: let CI be the builder. When the check fails, the workflow uploads the freshly built `dist/` as an artifact (`ncc-build`) and then fails the run. I download that file, commit it, and the next run is green.

> **Rule I took from this:** if CI compares a build output against a committed copy, the committed copy has to be built in the same environment as CI.

Checked afterwards: building `dist/` again on a different Linux machine, in a different folder, gave a file identical to the committed one.

---

## ✅ Verified

| Check | Result |
|-------|--------|
| Unit tests | 13 pass, 0 fail |
| 7 case matrix | 7 green (and shown to go red when a value is wrong) |
| Used from a different repo as `@v1` | Worked, correct outputs, outputs readable in the next step |
| Different runner (Azure runner image, then an AWS one) | Same output |
| `dist/` rebuild matches the committed file | Yes, on Linux |
| Step run time | about 0.07 to 0.16 seconds (no setup step, no install) |

---

## 🆚 JavaScript action vs the composite action I built earlier

| | Composite action (earlier project) | JavaScript action (this one) |
|---|---|---|
| Written in | YAML steps calling shell | Node.js |
| Startup | Runs shell steps in order | Runs one Node process directly |
| Logic and tests | Hard to unit test | Plain functions, unit tested |
| Needs a build step | No | Yes (`ncc` bundle in `dist/`) |
| Extra care | None | Keep `dist/` in sync with `src/` |

---

## 🚫 What I did not do

- I did not validate against the official semver regular expression or use the `semver` npm package. The parser is hand written so I understand every rule, and the unit tests cover the cases I know about. It may differ from the official spec in cases I did not think of.
- Uppercase `V` is rejected on purpose. Only a lowercase `v` prefix is accepted.
- `docker-tags` is a comma separated string, not JSON, so it is easy to pass to `docker/metadata-action` style inputs, but you have to split it yourself if you want a list.
- The action is not published to the GitHub Marketplace.
- Only `ubuntu-24.04` hosted runners were tested.

---

## 📂 Project layout

```
.
├── action.yml                 # inputs, outputs, runs: node24 -> dist/index.js
├── src/
│   ├── index.js               # reads inputs, sets outputs, fails or warns
│   └── semver.js              # the parsing rules
├── test/semver.test.js        # 13 unit tests
├── dist/index.js              # ncc bundle (built on Linux, committed)
├── .gitattributes             # dist/** text eol=lf
└── .github/workflows/
    ├── ci.yml                 # tests + rebuild + dist freshness check
    └── test-action.yml        # 7 case end to end matrix
```
