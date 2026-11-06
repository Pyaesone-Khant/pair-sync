import { Vibration } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';

export interface ISoundService {
  startIncomingRingtone(): Promise<void>;
  stopIncomingRingtone(): Promise<void>;
  playMessageChime(): Promise<void>;
}

/**
 * Production Sound & Haptic Service.
 * Manages low-latency audio playback for incoming call ringtones (looping)
 * and new encrypted message chimes (one-shot) via modern expo-audio.
 * Configures system audio sessions to obey background & silent mode rules.
 */
export class SoundService implements ISoundService {
  private ringtonePlayer: AudioPlayer | null = null;
  private isRinging: boolean = false;
  private isAudioModeConfigured: boolean = false;

  private async ensureAudioMode(): Promise<void> {
    if (this.isAudioModeConfigured) return;
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
      });
      this.isAudioModeConfigured = true;
    } catch (err) {
      console.warn('[SoundService] Failed to configure AudioMode:', err);
    }
  }

  /**
   * Starts looping ringtone and rhythmic vibration for an incoming call.
   */
  public async startIncomingRingtone(): Promise<void> {
    if (this.isRinging) return;
    this.isRinging = true;

    try {
      await this.ensureAudioMode();

      // Trigger continuous rhythmic vibration: 0ms delay, 1000ms vibrate, 1000ms pause
      Vibration.vibrate([0, 1000, 1000], true);

      let ringtoneSource: unknown;
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        ringtoneSource = require('../../../assets/sounds/ringtone.wav');
      } catch {
        ringtoneSource = { uri: 'assets/sounds/ringtone.wav' };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const player = createAudioPlayer(ringtoneSource as any);
      player.loop = true;
      player.volume = 1.0;
      player.play();
      this.ringtonePlayer = player;
      console.log('[SoundService] Ringtone started via expo-audio');
    } catch (err) {
      console.warn('[SoundService] Error starting ringtone:', err);
    }
  }

  /**
   * Immediately terminates ringtone sound and cancels vibration pattern.
   */
  public async stopIncomingRingtone(): Promise<void> {
    this.isRinging = false;
    Vibration.cancel();

    if (this.ringtonePlayer) {
      const playerToTeardown = this.ringtonePlayer;
      this.ringtonePlayer = null;
      try {
        playerToTeardown.pause();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (playerToTeardown as any).release?.();
        console.log('[SoundService] Ringtone stopped and released');
      } catch (err) {
        console.warn('[SoundService] Error stopping ringtone player:', err);
      }
    }
  }

  /**
   * Plays a crisp one-shot chime and subtle haptic feedback for incoming messages.
   */
  public async playMessageChime(): Promise<void> {
    try {
      await this.ensureAudioMode();

      // Gentle haptic tap
      Vibration.vibrate(60);

      let chimeSource: unknown;
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        chimeSource = require('../../../assets/sounds/message_pop.wav');
      } catch {
        chimeSource = { uri: 'assets/sounds/message_pop.wav' };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const player = createAudioPlayer(chimeSource as any);
      player.volume = 0.85;
      player.play();
    } catch (err) {
      console.warn('[SoundService] Error playing message chime:', err);
    }
  }
}

// Singleton helper
let soundServiceInstance: SoundService | null = null;

export function getSoundService(): SoundService {
  if (!soundServiceInstance) {
    soundServiceInstance = new SoundService();
  }
  return soundServiceInstance;
}
