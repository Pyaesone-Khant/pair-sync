# Multi-Tier State Architecture: Ephemeral Streams vs. Local-First Relational

We chose a multi-tier state architecture combining Zustand micro-stores for ephemeral high-frequency streams, TanStack Query for server state, and Drizzle ORM over `expo-sqlite` for persistent local data. High-frequency GPS updates, compass headings, and call states are dispatched directly through lightweight Zustand micro-stores to avoid React tree re-render thrashing, while chat history, cryptographic ratchet states, and offline Places are queried with full type safety via Drizzle ORM.
