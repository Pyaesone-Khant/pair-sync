# Adaptive Location Tracking with Peer-Triggered Escalation

We chose an adaptive location state machine (Stationary vs. Transit) with transient high-frequency escalation rather than continuous polling. Continuous GPS tracking drains 15-25% battery per hour, which causes mobile operating systems to throttle or terminate background execution. By keeping GPS hardware dormant during stationary periods and escalating to high-frequency streaming only when the peer actively views the map, we achieve near-instantaneous live tracking with an all-day battery footprint under 5%.
