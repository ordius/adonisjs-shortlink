# Changelog

All notable changes to this project will be documented in this file.



## [2.0.0](https://github.com/mixxtor/adonisjs-shortlink/compare/v1.1.2...v2.0.0) (2026-09-18)

### ⚠ BREAKING CHANGES

* rewrite shortlink service for AdonisJS 7
* update stubs and configure hook for the v2 contract

### ✨ Features

* rewrite shortlink service for AdonisJS 7 ([39c00eb](https://github.com/mixxtor/adonisjs-shortlink/commit/39c00ebc64b2e1833175a5cb6dd0f7b2a3e052c5))
* update stubs and configure hook for the v2 contract ([051690c](https://github.com/mixxtor/adonisjs-shortlink/commit/051690c32fa2282941f0264a7b9b56554423bca4))

### 🐛 Bug Fixes

* compare domains without port, retry slug collisions inside transactions ([9698788](https://github.com/mixxtor/adonisjs-shortlink/commit/9698788a73097b7f2831eda2e8612d13519bd875))

### 📚 Documentation

* rewrite README for v2 ([bd34f02](https://github.com/mixxtor/adonisjs-shortlink/commit/bd34f02288a3c568c9b8aa257424f178884aea4e))

### 🧪 Tests

* add unit and integration coverage for the v2 service ([ad93f06](https://github.com/mixxtor/adonisjs-shortlink/commit/ad93f06cb65f701bd3162d22867dbdac22259e36))

### 🔧 Maintenance

* add repository, homepage, bugs and engines metadata ([169a11e](https://github.com/mixxtor/adonisjs-shortlink/commit/169a11e3b4a4760d4c669093e0c0c600fdd5245e))
* **deps-dev:** bump @adonisjs/assembler from 7.8.2 to 8.4.0 ([ce81d9b](https://github.com/mixxtor/adonisjs-shortlink/commit/ce81d9b08109a558fd6d08f42afcf01fbdd3e100))
* **deps-dev:** bump @adonisjs/core from 6.21.0 to 7.3.4 ([ec9d1f6](https://github.com/mixxtor/adonisjs-shortlink/commit/ec9d1f6333e5d75f668176dec79bdbbae1b6d280))
* **deps-dev:** bump @adonisjs/lucid from 21.8.2 to 22.4.2 ([31fb2a7](https://github.com/mixxtor/adonisjs-shortlink/commit/31fb2a7d6b6e78b2198f7e855ced72921770f117))
* **deps-dev:** bump @release-it/conventional-changelog ([2e5c9fa](https://github.com/mixxtor/adonisjs-shortlink/commit/2e5c9fa1df90c91d9119457a3520652f6db13f4e))
* **deps-dev:** bump eslint from 9.39.4 to 10.5.0 ([54ddb69](https://github.com/mixxtor/adonisjs-shortlink/commit/54ddb69f398c060bf4db9c44e0a33382c7ba386c))
* **deps-dev:** bump release-it from 19.2.4 to 20.2.0 ([385107d](https://github.com/mixxtor/adonisjs-shortlink/commit/385107da29d034bd3412d421ba97bd60d7c5f0cc))
* fix unsupported engine package ([8af1c88](https://github.com/mixxtor/adonisjs-shortlink/commit/8af1c88da6b3121f4d1819338fe43c4db7b699fa))
* switch to @adonisjs/eslint-config, add japa/sqlite test deps ([5de00d7](https://github.com/mixxtor/adonisjs-shortlink/commit/5de00d712c0c3b9ca0a9de62a3c1e3eaee305438))
* update changelog links for version 1.1.2 and 1.1.1 ([2ec6c8e](https://github.com/mixxtor/adonisjs-shortlink/commit/2ec6c8ef13c46d045222822bdc028a8eb84669b6))
* update dependencies ([23751b2](https://github.com/mixxtor/adonisjs-shortlink/commit/23751b2c3f9cdf6f1b3ede77c8e043eab48c8171))
* update package name from [@mixxtor](https://github.com/mixxtor) to [@ordius](https://github.com/ordius) ([17942ac](https://github.com/mixxtor/adonisjs-shortlink/commit/17942acc4f41eaee8cd72d15c260a8a4f68bab2a))
* update README and package.json for AdonisJS v7 compatibility; improve stubs documentation ([e47fae8](https://github.com/mixxtor/adonisjs-shortlink/commit/e47fae887b258e9587751e9d49fe888614fea2a4))

## [1.1.2](https://github.com/mixxtor/adonisjs-shortlink/compare/v1.1.1...v1.1.2) (2025-12-16)

### 🐛 Bug Fixes

- update dependency versions and improve formatting in ShortlinkService d9d4a10

### 🔧 Maintenance

- update dependencies cac95bc
- update formatting and improve code clarity across multiple files a823f23

## [1.1.1](https://github.com/mixxtor/adonisjs-shortlink/compare/v1.1.0...v1.1.1) (2025-10-27)

- fix: update baseUrl handling in ShortlinkService to ensure proper prefix formatting ([182c5ec](https://github.com/mixxtor/adonisjs-shortlink/commit/182c5ec))
- fix: update updateOrCreate method to use slug for shortlink identification and remove CreateShortlin ([3eeed30](https://github.com/mixxtor/adonisjs-shortlink/commit/3eeed30))
- refactor: rename getBasePathUrl to getBaseUrl and update related methods for clarity ([2700316](https://github.com/mixxtor/adonisjs-shortlink/commit/2700316))

## [1.1.0](https://github.com/mixxtor/adonisjs-shortlink/compare/v1.0.0...v1.1.0) (2025-10-23)

### 🐛 Bug Fixes

- Remove unnecessary path argument from startPath in shortlink.stub ([e7a0ccc](https://github.com/mixxtor/adonisjs-shortlink/commit/e7a0cccb110fac41825cf7561bef8651b8820e2e))

## [1.0.0](https://github.com/mixxtor/adonisjs-shortlink/compare/v1.0.0-beta.7...v1.0.0) (2025-10-23)

### 🐛 Bug Fixes

- Correct path argument in startPath and update import paths for consistency ([b8898ab](https://github.com/mixxtor/adonisjs-shortlink/commit/b8898ab9ebd325af00e23e5d0cc45ed70e6cb304))

## [1.0.0-beta.7](https://github.com/mixxtor/adonisjs-shortlink/compare/v1.0.0-beta.6...v1.0.0-beta.7) (2025-10-23)

### ✨ Features

- Enhance shortlink package with route generation, controller setup, and configuration improvements ([749880b](https://github.com/mixxtor/adonisjs-shortlink/commit/749880bda3d3b53b9016e3000820aa5e9ba60548))
- **refactor:** Refactor shortlink service and controller for improved configuration handling and dependency injection ([bae6fa6](https://github.com/mixxtor/adonisjs-shortlink/commit/bae6fa640001a8a6dc8ec92412890eeddcb7ccc7))
- **refactor:** Rename 'path' to 'prefix' in configuration and related components for clarity ([a5467ae](https://github.com/mixxtor/adonisjs-shortlink/commit/a5467ae13f63a0f9855fb0cb12b2a7a80b57a36d))

## [1.0.0-beta.6](https://github.com/mixxtor/adonisjs-shortlink/compare/v1.0.0-beta.5...v1.0.0-beta.6) (2025-10-23)

### ✨ Features

- **refactor:** Update shortlink configuration and service, including model handling and migration stubs ([ea30888](https://github.com/mixxtor/adonisjs-shortlink/commit/ea308881c582aa4ddf713aa9e965902f06e224fb))

## [1.0.0-beta.5](https://github.com/mixxtor/adonisjs-shortlink/compare/v1.0.0-beta.4...v1.0.0-beta.5) (2025-10-22)

### ✨ Features

- Enhance shortlink configuration and service ([ef0cb94](https://github.com/mixxtor/adonisjs-shortlink/commit/ef0cb948e7af3b843aae103daa24716db41cf4ca))

## [1.0.0-beta.4](https://github.com/mixxtor/adonisjs-shortlink/compare/v1.0.0-beta.3...v1.0.0-beta.4) (2025-10-22)

### ✨ Features

- Enhance shortlink service with improved configuration and type safety ([fae07c3](https://github.com/mixxtor/adonisjs-shortlink/commit/fae07c3959ebe32e0c511d9fb3ecd7554307d483))
- update test command to use tsnode and add ESM hook for TypeScript execution ([d92639a](https://github.com/mixxtor/adonisjs-shortlink/commit/d92639a21a71c2be63d98bd86e4bac214345e6ac))

### 🔧 Maintenance

- update dependencies ([e746308](https://github.com/mixxtor/adonisjs-shortlink/commit/e746308469b9be83cbef395170eb477610ffda74))

## [1.0.0-beta.3](https://github.com/mixxtor/adonisjs-shortlink/compare/v1.0.0-beta.2...v1.0.0-beta.3) (2025-10-16)

### ✨ Features

- enhance shortlink service with model support and validation ([883d24b](https://github.com/mixxtor/adonisjs-shortlink/commit/883d24b1a0fdf2fc2ad33672c129f24bdb1649d1))

## [1.0.0-beta.2](https://github.com/mixxtor/adonisjs-shortlink/compare/v1.0.0-beta.1...v1.0.0-beta.2) (2025-10-16)

### 🐛 Bug Fixes

- add missing export statements to shortlink and migration stubs ([3e896b0](https://github.com/mixxtor/adonisjs-shortlink/commit/3e896b0f63f4ecdf7697ef2956ffb858b5a52b76))
- update logo URL in README and add logo.svg file ([05cb638](https://github.com/mixxtor/adonisjs-shortlink/commit/05cb638d1d48edc489a9524784c1b5437675456d))

## [1.0.0-beta.1](https://github.com/mixxtor/adonisjs-shortlink/compare/v1.0.0-beta.0...v1.0.0-beta.1) (2025-10-16)

### 🐛 Bug Fixes

- correct shortlink configuration stub for AdonisJS ([cf31e51](https://github.com/mixxtor/adonisjs-shortlink/commit/cf31e51d0cdfa8f70ea59d9250a0bba8dda11067))

## 1.0.0-beta.0 (2025-10-16)
