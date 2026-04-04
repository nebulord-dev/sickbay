## [1.7.1](https://github.com/nebulord-dev/sickbay/compare/v1.7.0...v1.7.1) (2026-04-04)


### Bug Fixes

* **cli:** externalize jiti from bundle and skip config load during init ([8c5aff9](https://github.com/nebulord-dev/sickbay/commit/8c5aff9dcffab069f24cd2f0b1633a89a880d25f))

# [1.7.0](https://github.com/nebulord-dev/sickbay/compare/v1.6.0...v1.7.0) (2026-04-04)


### Features

* **cli:** add sickbay/config entry point for defineConfig re-export (KAN-99) ([88f9c6f](https://github.com/nebulord-dev/sickbay/commit/88f9c6fb641bb6d5ea5ec9ebaa3d2f0503490349))
* **cli:** generate sickbay.config.ts from sickbay init with framework-aware checks (KAN-99) ([b083f23](https://github.com/nebulord-dev/sickbay/commit/b083f237221d0fb56999fa2208027f9b37c0f28f))
* **cli:** show custom config active notices in Summary and TUI ScorePanel (KAN-99) ([bd70f1a](https://github.com/nebulord-dev/sickbay/commit/bd70f1a1d7e785babb41806871bacb07ed858446))
* **core:** add isCheckDisabled, resolveConfigMeta, and validateConfig (KAN-99) ([98fea43](https://github.com/nebulord-dev/sickbay/commit/98fea433ccdeb61645bd9b78b002b1e891d3ec61))
* **core:** add loadConfig with jiti for runtime TS config loading (KAN-99) ([5e77433](https://github.com/nebulord-dev/sickbay/commit/5e774335f99b11ea28e4a3bb709ace8c51de3050))
* **core:** add SickbayConfig types and defineConfig helper (KAN-99) ([cd158ee](https://github.com/nebulord-dev/sickbay/commit/cd158eebbb82f6f2692e0d965e5afd09d118b432))
* **core:** wire config loading into runner pipeline, filter disabled checks (KAN-99) ([7c2f840](https://github.com/nebulord-dev/sickbay/commit/7c2f84056d7863ea8fe7bdfcc06c83ffdfaa8eb9))

# [1.6.0](https://github.com/nebulord-dev/sickbay/compare/v1.5.0...v1.6.0) (2026-04-03)


### Features

* add angular-security, angular-template-performance, and angular-build-config checks (KAN-134) ([e750b6e](https://github.com/nebulord-dev/sickbay/commit/e750b6e54c31a4c68b59f2805b34cc31cdcd4ea5))

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
