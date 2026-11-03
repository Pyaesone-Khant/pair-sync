# Pair Sync

Real-time presence, location sync, encrypted messaging, and peer-to-peer calling between paired personal devices.

## Language

**Pair**:
An exclusive bidirectional relationship established between two specific devices.
_Avoid_: Circle, Room, Channel, Group

**Peer**:
The counterpart device participating in a Pair.
_Avoid_: Contact, Friend, User, Client

**Account**:
The authenticated identity record managed by the identity provider (Google Auth via Supabase) to authorize access to backend services.
_Avoid_: Profile, User, Peer

**Device Keypair**:
The locally generated asymmetric cryptographic keypair tied to physical device hardware.
_Avoid_: Password, Account key, API key

**Pairing Ceremony**:
The out-of-band exchange (via QR code or secure deep link) of public device keys and authorization tokens that establishes a Pair.
_Avoid_: Friend request, Invitation, Connection

**Signaling Channel**:
An ephemeral real-time communication path used solely to coordinate connection setup and presence between peers.
_Avoid_: Message queue, Chat bus, Data pipeline

**Wake-up Payload**:
A high-priority silent system push notification that prompts a backgrounded or sleeping peer device to execute a transient sync or display an incoming call screen.
_Avoid_: Alert, Ping, Notification message

**Stationary State**:
A state where the device remains within a defined boundary, during which high-precision GPS hardware is dormant.
_Avoid_: Idle, Paused, Inactive

**Transit State**:
A state detected by motion hardware where continuous physical displacement triggers adaptive periodic coordinate sampling.
_Avoid_: Moving, Active, Driving, Walking

**Live Viewing**:
A transient, high-frequency location streaming state initiated only while the Peer actively focuses the map viewport on the device.
_Avoid_: Watching, Realtime tracking, Live mode

**Coordinate Interpolation**:
Algorithmic smoothing applied to sequential GPS coordinates to animate avatar motion continuously along roads.
_Avoid_: Animation, Easing, Smoothing

**Viewport**:
The dynamic map camera bounding box focused on the user, the peer, or the midpoint between both devices.
_Avoid_: Map view, Screen, Camera view

**Place**:
A locally stored geographic coordinate and radius representing a meaningful physical location.
_Avoid_: Geofence, Marker, Point of Interest, Destination

**Boundary Event**:
An encrypted arrival or departure notification generated autonomously by client hardware when crossing a Place perimeter.
_Avoid_: Geofence trigger, Alert, Notification event

**Ciphertext Envelope**:
An encrypted message container whose inner content can only be decrypted by the recipient Peer holding the ratchet key.
_Avoid_: Message body, Payload, Packet

**Local Store**:
The on-device encrypted SQLite database holding all message logs, media references, and cryptographic ratchet states.
_Avoid_: Local storage, Cache, App database

**Blind Relay**:
The transient backend mailbox mechanism that routes Ciphertext Envelopes without storing plaintext or retaining delivered entries.
_Avoid_: Message broker, Message queue, Cloud database

**Call Session**:
A peer-to-peer real-time media exchange lifecycle negotiated over WebRTC and mediated by the telephony subsystem.
_Avoid_: Meeting, Room, Conference, Stream

**Relay Node**:
A network traversal proxy (STUN/TURN) utilized only when direct peer-to-peer network address translation (NAT) traversal fails.
_Avoid_: Proxy, Media server, Gateway

**System Call Screen**:
The operating system's native telephony interface (CallKit on iOS, TelecomManager on Android) used to present incoming and active call states outside the application sandbox.
_Avoid_: Ringing modal, Notification banner, In-app dialer
