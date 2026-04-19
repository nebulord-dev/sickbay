## [1.16.4](https://github.com/nebulord-dev/sickbay/compare/v1.16.3...v1.16.4) (2026-04-19)


### Bug Fixes

* **cli:** atomic history writes and git-cleanliness preflight for fix ([#55](https://github.com/nebulord-dev/sickbay/issues/55)) ([b6973ca](https://github.com/nebulord-dev/sickbay/commit/b6973ca9f11ca6dcf24240af413f0b3a17e7b7de))

## [1.16.3](https://github.com/nebulord-dev/sickbay/compare/v1.16.2...v1.16.3) (2026-04-19)


### Bug Fixes

* **cli:** harden badge HTML output and lock web-server CORS to dashboard origin ([#54](https://github.com/nebulord-dev/sickbay/issues/54)) ([0a663d9](https://github.com/nebulord-dev/sickbay/commit/0a663d9568599930f111f8c92285b9297e0b0854))

## [1.16.2](https://github.com/nebulord-dev/sickbay/compare/v1.16.1...v1.16.2) (2026-04-19)


### Bug Fixes

* **repo:** untrack .sickbay/ cache files and generalize gitignore patterns ([#53](https://github.com/nebulord-dev/sickbay/issues/53)) ([1de7b1d](https://github.com/nebulord-dev/sickbay/commit/1de7b1d69d21efdf61d45b5e92c635bf6375d111)), closes [#52](https://github.com/nebulord-dev/sickbay/issues/52)

## [1.16.1](https://github.com/nebulord-dev/sickbay/compare/v1.16.0...v1.16.1) (2026-04-18)


### Bug Fixes

* correct issue in VitePress build ([#48](https://github.com/nebulord-dev/sickbay/issues/48)) ([1ebbea3](https://github.com/nebulord-dev/sickbay/commit/1ebbea3b78e5a5f4f1219aa1872c7158706e4230))

# [1.16.0](https://github.com/nebulord-dev/sickbay/compare/v1.15.10...v1.16.0) (2026-04-18)


### Features

* deduplicate warning counts in dashboard and CLI ([#46](https://github.com/nebulord-dev/sickbay/issues/46)) ([d6434d1](https://github.com/nebulord-dev/sickbay/commit/d6434d1c9da4206a46c09fde4249ca6d60f4d6bb))

## [1.15.10](https://github.com/nebulord-dev/sickbay/compare/v1.15.9...v1.15.10) (2026-04-09)


### Bug Fixes

* **cli:** resolve issue with port in use ([0725198](https://github.com/nebulord-dev/sickbay/commit/0725198480719c34439b2f16f5f4ba550a480c3d))

## [1.15.9](https://github.com/nebulord-dev/sickbay/compare/v1.15.8...v1.15.9) (2026-04-09)


### Bug Fixes

* **web:** show installed version for outdated deps instead of declared range ([208ff8b](https://github.com/nebulord-dev/sickbay/commit/208ff8bd58386d4999e96cbaffd32b3f3dbf046c))

## [1.15.8](https://github.com/nebulord-dev/sickbay/compare/v1.15.7...v1.15.8) (2026-04-08)


### Bug Fixes

* address audit findings across core, cli, and web ([3f85013](https://github.com/nebulord-dev/sickbay/commit/3f8501366336ad547245cf6940a680484655e3f6))
* **cli:** add explicit type annotation to suppress implicit any in checks filter ([679a24e](https://github.com/nebulord-dev/sickbay/commit/679a24ec11c4d6b6e947efc00e89e95f63797bdf))
* **web:** address audit findings in load-report and DependencyList ([c540b33](https://github.com/nebulord-dev/sickbay/commit/c540b331406aa6f5639acb14bc9c476f5e0a6364))

## [1.15.7](https://github.com/nebulord-dev/sickbay/compare/v1.15.6...v1.15.7) (2026-04-08)


### Bug Fixes

* **cli:** suppress knip false positives for bundled-deps ([142e9be](https://github.com/nebulord-dev/sickbay/commit/142e9be94709c128cf0b77d22739341243d5a62b))

## [1.15.6](https://github.com/nebulord-dev/sickbay/compare/v1.15.5...v1.15.6) (2026-04-08)


### Bug Fixes

* **core:** cross-platform isCommandAvailable (which → where on Windows) ([#33](https://github.com/nebulord-dev/sickbay/issues/33)) ([eb2a743](https://github.com/nebulord-dev/sickbay/commit/eb2a743daf45310435c91c34ec19f8051b21bde8)), closes [#1](https://github.com/nebulord-dev/sickbay/issues/1) [#32](https://github.com/nebulord-dev/sickbay/issues/32)

## [1.15.5](https://github.com/nebulord-dev/sickbay/compare/v1.15.4...v1.15.5) (2026-04-08)


### Bug Fixes

* **core:** cross-platform path handling + add Windows to CI matrix ([#32](https://github.com/nebulord-dev/sickbay/issues/32)) ([7137967](https://github.com/nebulord-dev/sickbay/commit/7137967ce2f6bbf12cb708a559a8f0356eb9d8ec))

## [1.15.4](https://github.com/nebulord-dev/sickbay/compare/v1.15.3...v1.15.4) (2026-04-08)


### Bug Fixes

* **core:** address PR feedback on bug-cluster review ([6d90d45](https://github.com/nebulord-dev/sickbay/commit/6d90d45b8690226928452847d3ef302d8888efbd))
* **core:** cluster of bug fixes from audit follow-ups ([0898e98](https://github.com/nebulord-dev/sickbay/commit/0898e98bbd1555d48e5a35c1ff72977ff89dda86)), closes [post-PR-#27](https://github.com/post-PR-/issues/27) [#1](https://github.com/nebulord-dev/sickbay/issues/1) [#7](https://github.com/nebulord-dev/sickbay/issues/7) [#4](https://github.com/nebulord-dev/sickbay/issues/4) [#2](https://github.com/nebulord-dev/sickbay/issues/2) [#9](https://github.com/nebulord-dev/sickbay/issues/9)

## [1.15.3](https://github.com/nebulord-dev/sickbay/compare/v1.15.2...v1.15.3) (2026-04-08)


### Bug Fixes

* **advisors:** wire BestPractices into CLI, tighten checks, fix architect agent ([7923306](https://github.com/nebulord-dev/sickbay/commit/79233060e9c8badaeec71ad52dade1f5e26ddea7))

## [1.15.2](https://github.com/nebulord-dev/sickbay/compare/v1.15.1...v1.15.2) (2026-04-08)


### Bug Fixes

* **ci:** make .sickbay oxfmt ignore pattern recursive ([f37f61d](https://github.com/nebulord-dev/sickbay/commit/f37f61d1daee51514e9937204cd7c6321e58b8aa))

## [1.15.1](https://github.com/nebulord-dev/sickbay/compare/v1.15.0...v1.15.1) (2026-04-08)


### Bug Fixes

* **ci:** make .sickbay oxfmt ignore pattern recursive ([5093899](https://github.com/nebulord-dev/sickbay/commit/509389974e7eea104f4903903071518946422df6))
* **security:** patch command injection, CVEs, and web server exposure ([30882a4](https://github.com/nebulord-dev/sickbay/commit/30882a49b8bab64ddbf38eb8d6156f878555bea8))

# [1.15.0](https://github.com/nebulord-dev/sickbay/compare/v1.14.3...v1.15.0) (2026-04-05)


### Features

* add claude command to generate a skill to give Claude Code users context on sickbay files ([3244be0](https://github.com/nebulord-dev/sickbay/commit/3244be0890c124756c42e4e73db0f4d8503bf0d2))

## [1.14.3](https://github.com/nebulord-dev/sickbay/compare/v1.14.2...v1.14.3) (2026-04-05)


### Bug Fixes

* show skipped checks in the web dashboard ([ec99054](https://github.com/nebulord-dev/sickbay/commit/ec99054f4484f34443c0a35134bb8ccfc283f1a3))

## [1.14.2](https://github.com/nebulord-dev/sickbay/compare/v1.14.1...v1.14.2) (2026-04-05)


### Bug Fixes

* suppressed runner should affect the score ([d2ce56a](https://github.com/nebulord-dev/sickbay/commit/d2ce56aa1a16bf6310581cfab3efbd7f8d911fdf))

## [1.14.1](https://github.com/nebulord-dev/sickbay/compare/v1.14.0...v1.14.1) (2026-04-05)


### Bug Fixes

* update fixture snapshots and angular.json defaultProject (KAN-144) ([b339e7a](https://github.com/nebulord-dev/sickbay/commit/b339e7ad22d4408966629081c300f67c240f0f3d))

# [1.14.0](https://github.com/nebulord-dev/sickbay/compare/v1.13.0...v1.14.0) (2026-04-05)


### Bug Fixes

* **core:** use detected package manager in fix commands, add test assertions (KAN-144) ([a97ac03](https://github.com/nebulord-dev/sickbay/commit/a97ac03abd4aed0dd058736ba0256236f9640ace))


### Features

* **core:** add missing fix commands to runners (KAN-144) ([8e783b6](https://github.com/nebulord-dev/sickbay/commit/8e783b615846846d47b724b203fa80651b3b3dbb))

# [1.13.0](https://github.com/nebulord-dev/sickbay/compare/v1.12.0...v1.13.0) (2026-04-05)


### Bug Fixes

* address PR review feedback for suppress snippet (KAN-140) ([c6ead8f](https://github.com/nebulord-dev/sickbay/commit/c6ead8fdc005db369435a3991235072d71b97e3e))


### Features

* **core:** add suppressMatch field to Issue type (KAN-140) ([b77d510](https://github.com/nebulord-dev/sickbay/commit/b77d510532adbe8cd5959144f7caaf50a7946fa3))
* **core:** add suppressMatch to framework-specific runners (KAN-140) ([7b1dfd7](https://github.com/nebulord-dev/sickbay/commit/7b1dfd73c2ea65c53883cfb762dbd8f689a9b376))
* **core:** add suppressMatch to universal runners (KAN-140) ([9654f2e](https://github.com/nebulord-dev/sickbay/commit/9654f2e892812f7a0bc93ef093bc705e90cf9e13))
* **web:** add suppress button to IssueRow in web dashboard ([bfc2c90](https://github.com/nebulord-dev/sickbay/commit/bfc2c90fe03592654fe5c5c29704ef22487ffbab))
* **web:** add suppress info popover to issues tab (KAN-140) ([b4e119a](https://github.com/nebulord-dev/sickbay/commit/b4e119a2faa67dee1380604277dbbf23a8945b34))
* **web:** add suppress snippet generation utility (KAN-140) ([28b254b](https://github.com/nebulord-dev/sickbay/commit/28b254b5cdab0e17acbcc0a8edf8ebe855ad9aa2))

# [1.12.0](https://github.com/nebulord-dev/sickbay/compare/v1.11.0...v1.12.0) (2026-04-05)

### Features

- **core:** add Angular, Next.js, and Universal advisors (KAN-141, KAN-142, KAN-143) ([0bac709](https://github.com/nebulord-dev/sickbay/commit/0bac7098c700a93a135176dd3aa1a5af331c96b1))

# [1.11.0](https://github.com/nebulord-dev/sickbay/compare/v1.10.3...v1.11.0) (2026-04-05)

### Features

- **core:** add non-scored best practice recommendations system (KAN-139) ([d9962d6](https://github.com/nebulord-dev/sickbay/commit/d9962d618346f529d7809bf237b3dd5539daa981))

## [1.10.3](https://github.com/nebulord-dev/sickbay/compare/v1.10.2...v1.10.3) (2026-04-05)

### Bug Fixes

- **core:** npm-audit runner now detects package manager and scopes to target package ([c081fde](https://github.com/nebulord-dev/sickbay/commit/c081fdec5d403c736d44ee366cdef530b76372dd))

## [1.10.2](https://github.com/nebulord-dev/sickbay/compare/v1.10.1...v1.10.2) (2026-04-05)

### Bug Fixes

- **docs:** escape Vue template syntax in health-checks page ([a1c362e](https://github.com/nebulord-dev/sickbay/commit/a1c362ee0a1cbd2b331d69b5ddc91d6a55938c0d))

## [1.10.1](https://github.com/nebulord-dev/sickbay/compare/v1.10.0...v1.10.1) (2026-04-05)

### Bug Fixes

- **cli:** make sickbay init monorepo-aware (KAN-99 Phase F) ([ef0dab4](https://github.com/nebulord-dev/sickbay/commit/ef0dab4cafaabab1d3e5f385748a6bd3bf122cd8))

# [1.10.0](https://github.com/nebulord-dev/sickbay/compare/v1.9.0...v1.10.0) (2026-04-05)

### Features

- **core:** add config sync, reset, and per-package monorepo config (KAN-99 Phase F) ([00677d3](https://github.com/nebulord-dev/sickbay/commit/00677d342d91000cb197c02fa9f63b62c0cd63cd))

# [1.9.0](https://github.com/nebulord-dev/sickbay/compare/v1.8.0...v1.9.0) (2026-04-05)

### Features

- **core:** add exclude paths and weight overrides (KAN-99 Phase C) ([96ae44e](https://github.com/nebulord-dev/sickbay/commit/96ae44ecfbd2d0be1dcbaedb4615c1d5962c16fa))
- **core:** add per-check suppression rules (KAN-99 Phase D) ([a4f5e59](https://github.com/nebulord-dev/sickbay/commit/a4f5e5902cacf1afb7bc6d57e4967bb907bca197))
- **web:** add read-only Config tab to web dashboard ([f94ba03](https://github.com/nebulord-dev/sickbay/commit/f94ba03e4b267266991f139b62aac8fed1ee61fa))

# [1.8.0](https://github.com/nebulord-dev/sickbay/compare/v1.7.5...v1.8.0) (2026-04-04)

### Features

- **core:** add threshold overrides for 12 configurable runners (KAN-99 Phase B) ([0d51358](https://github.com/nebulord-dev/sickbay/commit/0d51358651523bd134a4e602a4deb92bcb1b5a0d))

## [1.7.5](https://github.com/nebulord-dev/sickbay/compare/v1.7.4...v1.7.5) (2026-04-04)

### Bug Fixes

- **core:** add displayName to BaseRunner so skipped checks show proper names ([fad9bed](https://github.com/nebulord-dev/sickbay/commit/fad9bedb2c69eb01f2f82fe3d93def116560081d))

## [1.7.4](https://github.com/nebulord-dev/sickbay/compare/v1.7.3...v1.7.4) (2026-04-04)

### Bug Fixes

- **core:** resolve relative paths to absolute before passing to jiti ([e4ee3c4](https://github.com/nebulord-dev/sickbay/commit/e4ee3c40891f81950ff2afd61fec04d0fe330292))

## [1.7.3](https://github.com/nebulord-dev/sickbay/compare/v1.7.2...v1.7.3) (2026-04-04)

### Bug Fixes

- **core:** filter sickbay.config.ts from knip unused file false positives ([bb61d52](https://github.com/nebulord-dev/sickbay/commit/bb61d52a0059499cca05951edef500f9fc76de58))

## [1.7.2](https://github.com/nebulord-dev/sickbay/compare/v1.7.1...v1.7.2) (2026-04-04)

### Bug Fixes

- **cli:** use JSDoc type annotation instead of defineConfig import in generated config ([9b547d8](https://github.com/nebulord-dev/sickbay/commit/9b547d8e905425b6f15cdff6e8f3ddef29c5c46d))

## [1.7.1](https://github.com/nebulord-dev/sickbay/compare/v1.7.0...v1.7.1) (2026-04-04)

### Bug Fixes

- **cli:** externalize jiti from bundle and skip config load during init ([8c5aff9](https://github.com/nebulord-dev/sickbay/commit/8c5aff9dcffab069f24cd2f0b1633a89a880d25f))

# [1.7.0](https://github.com/nebulord-dev/sickbay/compare/v1.6.0...v1.7.0) (2026-04-04)

### Features

- **cli:** add sickbay/config entry point for defineConfig re-export (KAN-99) ([88f9c6f](https://github.com/nebulord-dev/sickbay/commit/88f9c6fb641bb6d5ea5ec9ebaa3d2f0503490349))
- **cli:** generate sickbay.config.ts from sickbay init with framework-aware checks (KAN-99) ([b083f23](https://github.com/nebulord-dev/sickbay/commit/b083f237221d0fb56999fa2208027f9b37c0f28f))
- **cli:** show custom config active notices in Summary and TUI ScorePanel (KAN-99) ([bd70f1a](https://github.com/nebulord-dev/sickbay/commit/bd70f1a1d7e785babb41806871bacb07ed858446))
- **core:** add isCheckDisabled, resolveConfigMeta, and validateConfig (KAN-99) ([98fea43](https://github.com/nebulord-dev/sickbay/commit/98fea433ccdeb61645bd9b78b002b1e891d3ec61))
- **core:** add loadConfig with jiti for runtime TS config loading (KAN-99) ([5e77433](https://github.com/nebulord-dev/sickbay/commit/5e774335f99b11ea28e4a3bb709ace8c51de3050))
- **core:** add SickbayConfig types and defineConfig helper (KAN-99) ([cd158ee](https://github.com/nebulord-dev/sickbay/commit/cd158eebbb82f6f2692e0d965e5afd09d118b432))
- **core:** wire config loading into runner pipeline, filter disabled checks (KAN-99) ([7c2f840](https://github.com/nebulord-dev/sickbay/commit/7c2f84056d7863ea8fe7bdfcc06c83ffdfaa8eb9))

# [1.6.0](https://github.com/nebulord-dev/sickbay/compare/v1.5.0...v1.6.0) (2026-04-03)

### Features

- add angular-security, angular-template-performance, and angular-build-config checks (KAN-134) ([e750b6e](https://github.com/nebulord-dev/sickbay/commit/e750b6e54c31a4c68b59f2805b34cc31cdcd4ea5))

# [1.5.0](https://github.com/nebulord-dev/sickbay/compare/v1.4.2...v1.5.0) (2026-04-03)

### Features

- project-type-aware file length thresholds (KAN-125) ([b413a56](https://github.com/nebulord-dev/sickbay/commit/b413a56cd34db4d06af59dacf770d585004788c1))

## [1.4.2](https://github.com/nebulord-dev/sickbay/compare/v1.4.1...v1.4.2) (2026-04-01)

### Bug Fixes

- show both npx and global install commands in update notice ([572daee](https://github.com/nebulord-dev/sickbay/commit/572daeedb84bffc5a87f4a9af6f5ee59f84207f2))

## [1.4.1](https://github.com/nebulord-dev/sickbay/compare/v1.4.0...v1.4.1) (2026-04-01)

### Bug Fixes

- use lowercase -v for version flag ([89ce19b](https://github.com/nebulord-dev/sickbay/commit/89ce19ba0e61afc37e7cd4e7e9dab33cd2c1ee2c))

# [1.4.0](https://github.com/nebulord-dev/sickbay/compare/v1.3.1...v1.4.0) (2026-04-01)

### Features

- add update check logic with npm registry fetch and caching ([853a28d](https://github.com/nebulord-dev/sickbay/commit/853a28df56ad13d26e85bd2ac647215532637503))
- add UpdateNotice Ink component ([520bc64](https://github.com/nebulord-dev/sickbay/commit/520bc64dddc87ce4177a4300386042806fb952d5))
- wire update notification into default scan ([dab5d04](https://github.com/nebulord-dev/sickbay/commit/dab5d04bda6bb8ef55089a1eb9c40b5b0f6e389e))
- wire update notification into TUI dashboard ([61661cc](https://github.com/nebulord-dev/sickbay/commit/61661cc81b627e5be4571e367582740297f9c68c))

## [1.3.1](https://github.com/nebulord-dev/sickbay/compare/v1.3.0...v1.3.1) (2026-04-01)

### Bug Fixes

- reset CLI version to match npm baseline (1.3.0) ([3d48c43](https://github.com/nebulord-dev/sickbay/commit/3d48c430e8fc3244102ce37325a65f9f00249fa2))

# [1.1.0](https://github.com/nebulord-dev/sickbay/compare/v1.0.1...v1.1.0) (2026-04-01)

### Bug Fixes

- use build-time version instead of hardcoded 0.0.1 ([dfb2ab4](https://github.com/nebulord-dev/sickbay/commit/dfb2ab454d8f25c874c3e1c894ef80ffc13ab95a))

### Features

- rename CLI package to sickbay, mark core as private ([d0df89d](https://github.com/nebulord-dev/sickbay/commit/d0df89d2c07d62d2a0eab22d2d043df0c76534a5))
