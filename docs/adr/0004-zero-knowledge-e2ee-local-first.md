# Zero-Knowledge End-to-End Encryption with Local-First Persistence

We chose a zero-knowledge Signal Double Ratchet encryption model with local-first SQLite persistence instead of storing plaintext messages in a centralized database. The Supabase backend serves exclusively as an ephemeral blind relay, discarding message envelopes as soon as the recipient peer acknowledges receipt. This eliminates cloud eavesdropping risks and provides complete offline access to historical conversations.
