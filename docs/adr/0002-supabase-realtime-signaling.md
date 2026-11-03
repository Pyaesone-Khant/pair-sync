# Supabase Realtime for Signaling and Wake-ups

We chose Supabase (Auth, Realtime WebSockets, and Edge Functions) for signaling and wake-up dispatches instead of maintaining a custom WebSocket daemon. This provides low-latency presence channels and cryptographic key discovery with zero server maintenance, while allowing Edge Functions to trigger APNs and FCM high-priority wake-up notifications when a peer device is backgrounded.
