# Native WebRTC with CallKit and STUN/TURN Relays

We chose native WebRTC (`react-native-webrtc`) paired with system telephony APIs (CallKit on iOS, TelecomManager on Android) and managed STUN/TURN relays instead of third-party hosted calling SDKs (like Agora or Twilio). This eliminates per-minute audio/video cloud costs, keeps streams end-to-end encrypted directly between devices, and delivers a true system-native incoming call experience that rings on the lock screen even when the app is suspended.
