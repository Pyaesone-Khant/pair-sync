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
