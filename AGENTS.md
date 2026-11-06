# Agent Instructions & Engineering Mandates (AGENTS.md)

Welcome to **Pair Sync**. This document establishes the foundational engineering principles, architectural patterns, quality standards, and automated workflows required for any AI agent or human contributor working on this repository.

---

## 1. Core Architectural Mandate: Clean Architecture

To guarantee long-term maintainability, testability, and code reusability, all application code must follow **Clean Architecture** with strict dependency inversion:

```
┌────────────────────────────────────────────────────────┐
│  Presentation Layer (`app/`, `src/presentation/`)     │
│  - Expo Router screens, UI components, UI hooks        │
│  - Zustand micro-stores for render isolation           │
├────────────────────────────────────────────────────────┤
│  Application / Use-Case Layer (`src/application/`)     │
│  - Use cases (e.g., `PairDeviceUseCase`, `SendMessage`)│
│  - Cryptographic coordination (Double Ratchet driver)  │
│  - Ports / Interfaces for infrastructure boundaries    │
├────────────────────────────────────────────────────────┤
│  Domain Layer (`src/domain/`)                          │
│  - Pure business entities & value objects              │
│  - Zero external dependencies (no Expo, React, SQLite) │
│  - State machines (e.g. `LocationTrackingStateMachine`)│
├────────────────────────────────────────────────────────┤
│  Infrastructure Layer (`src/infrastructure/`)          │
│  - Concrete adapters implementing application ports    │
│  - Supabase client, SQLite (Drizzle ORM) database      │
│  - Native drivers: WebRTC, Expo Location, Secure Store │
└────────────────────────────────────────────────────────┘
```

### Dependency Rule
* Inner layers (`domain`) **must never** import from outer layers (`infrastructure`, `presentation`).
* Business rules remain 100% testable in pure Node/TypeScript without mocking native mobile hardware.

---

## 2. Test-Driven Development (TDD) Mandate

Every feature or bug fix must follow the **Red-Green-Refactor** lifecycle:

1. **Red**: Write a failing unit or integration test defining the expected behavior, edge cases, and error boundaries.
2. **Green**: Implement the minimal, cleanest code required to make the test pass.
3. **Refactor**: Clean up duplication, enforce design patterns, and ensure strict type safety while keeping tests green.

### Testing Rules
* All business logic in `domain/` and `application/` must maintain near-100% test coverage.
* Never mock what you can instantiate cleanly in memory (e.g., use an in-memory database or fake ports instead of heavy mock libraries where feasible).
* All tests must pass before any code is committed.

---

## 3. Atomic Git Commit Workflow

To ensure a clean, bisectable git history:
* Work in **small, vertical slices** (tracer bullets).
* **Direct Atomic Commits**: As soon as a slice is successfully implemented and its tests pass, commit directly to git immediately.
* **Commit Message Standard**: Use Conventional Commits:
  * `feat(scope): ...` for new features
  * `test(scope): ...` for unit/integration tests
  * `fix(scope): ...` for bug fixes
  * `refactor(scope): ...` for code refactoring without behavior change
  * `docs(scope): ...` for documentation updates

---

## 4. Code Standards & Quality Guidelines

* **Language**: Strict TypeScript. No `any` under any circumstances (use `unknown` with type narrowing or generic constraints).
* **Formatting**: 2 spaces indentation, semicolons, single quotes where appropriate.
* **Documentation**: JSDoc on all public functions, domain entities, and interfaces, explaining **why** an approach was chosen rather than just describing the obvious syntax.
* **Single Responsibility**: Keep functions small, focused, and pure where possible.
* **Maintainability & Reusability**: Extract reusable utilities, hooks, and components into dedicated directories (`src/shared/`, `src/presentation/components/ui/`).

---

## 5. Domain Language & Living Architecture

* **Glossary**: Always consult and respect the project terminology defined in [`CONTEXT.md`](./CONTEXT.md). Use exact canonical terms (`Pair`, `Peer`, `Stationary State`, `Transit State`, `Ciphertext Envelope`, etc.).
* **ADRs**: Never violate architectural boundaries established in [`docs/adr/`](./docs/adr/). If an architectural change is required, discuss and record an ADR before proceeding.

---

## 6. Physical Device Deployment Playbook (iOS & Android)

For fast recognition by future agents, follow this exact playbook when testing, building, and installing PairSync on physical hardware.

### Target Hardware Registry

| Device | Model / Identifier | Platform | Bundle / Package ID | Connection Tool |
| :--- | :--- | :--- | :--- | :--- |
| **iPhone PK** | iPhone 14 Pro Max (`iPhone15,3`)<br>UDID: `00008120-00110C1E0293C01E`<br>Team ID: `D776JM53A3` | iOS Physical | `com.pairsync.app` | `xcrun devicectl` |
| **Xiaomi Mi 9** | Xiaomi Mi 9 (`cepheus` / `MI_9`)<br>Serial: `b53d42e6` | Android 10/11 Physical | `com.pairsync.app` | `adb` |

### Why Standalone Release Builds Are Mandatory

> [!IMPORTANT]
> **Always compile and install standalone Release builds for both physical devices:**
> 1. **Android Splash Screen Hang**: Debug APKs (`app-debug.apk`) do not bundle pre-compiled Hermes JavaScript bytecode; they wait indefinitely on a WebSocket connection to a local Metro bundler on port 8081. Release builds (`assembleRelease`) pre-compile all modules into Hermes bytecode (`index.android.bundle`), enabling immediate (<200ms) standalone boot.
> 2. **iOS C++ Prebuilt Linker Mismatch**: In Debug mode, `React-Core-prebuilt` expects non-inlined constructors for `facebook::react::Sealable`, causing undefined symbol linker errors. Release configuration (`-configuration Release`) completely inlines `Sealable`, bypassing linker errors and packing offline assets (`main.jsbundle`).

### Android (Xiaomi Mi 9) Build & Install Steps

```bash
# 1. Verify device is connected and authorized
adb devices
# Expected output: b53d42e6    device

# 2. Build standalone Release APK (Hermes bytecode pre-bundled)
cd android && ./gradlew --no-daemon assembleRelease
# Output artifact: android/app/build/outputs/apk/release/app-release.apk

# 3. Stream-install Release APK onto Xiaomi Mi 9
adb -s b53d42e6 install -r android/app/build/outputs/apk/release/app-release.apk

# 4. Launch PairSync MainActivity
adb -s b53d42e6 shell am start -n com.pairsync.app/.MainActivity

# 5. Diagnostic: Capture live screen verification
adb -s b53d42e6 shell screencap -p /sdcard/screen.png && adb -s b53d42e6 pull /sdcard/screen.png screen.png
```

### iOS (iPhone PK) Build & Install Steps

```bash
# 1. Verify iPhone PK connection status
xcrun devicectl list devices
# Expected: PK | 00008120-00110C1E0293C01E | available (paired)

# 2. Compile standalone Release binary with Apple Development provisioning
cd ios && xcodebuild \
  -workspace PairSync.xcworkspace \
  -scheme PairSync \
  -configuration Release \
  -destination 'id=00008120-00110C1E0293C01E' \
  -allowProvisioningUpdates

# 3. Install binary onto physical iPhone PK
xcrun devicectl device install app \
  --device 00008120-00110C1E0293C01E \
  ~/Library/Developer/Xcode/DerivedData/PairSync-amxbmllkhlcwzgdmklwytvsvjkbb/Build/Products/Release-iphoneos/PairSync.app

# 4. Launch application process on iPhone PK
xcrun devicectl device process launch \
  --device 00008120-00110C1E0293C01E \
  com.pairsync.app
```

### Agent Sandbox & Environment Mandates

* Commands interacting with physical USB/Wi-Fi devices (`adb`, `xcrun devicectl`) and macOS Keychain code signing (`xcodebuild`) must be executed with **`BypassSandbox: true`**.
* If ADB encounters port conflicts (`Address already in use`), reset the server via:
  ```bash
  adb kill-server && adb start-server && adb devices
  ```

---

## 7. WebRTC P2P Audio & Video Calling Architecture (ADR 0005)

### Pinned Dependency Standard
* **Package**: `react-native-webrtc@124.0.8`
* **iOS Pod**: `JitsiWebRTC (~> 124.0.2)`
* **Crucial Rule**: Never upgrade to unverified versions without verifying CocoaPods trunk specs (e.g., 155.0.x is not published to CocoaPods trunk and will fail `pod install`).

### Real-Time Video Streaming Pipeline
* **Native Video Rendering**: Video calls stream live peer-to-peer RTP video rendered via `<RTCView streamURL={stream.toURL()} />` from `react-native-webrtc`.
* **Zero Image Hacks**: Never use image/snapshot polling or static image overlays for video calls.
* **Stacking (`zOrder`)**:
  * Remote stream (full viewport): `zOrder={0}`
  * Local self-view (floating Picture-in-Picture): `zOrder={1}`
* **Camera Switching**: Invokes `videoTrack._switchCamera()` directly to flip local preview and outgoing RTP stream instantaneously without SDP renegotiation.
* **ICE Candidate Queueing**: Always queue incoming ICE candidates until `setRemoteDescription` resolves to prevent `"Remote description not set"` runtime exceptions.


