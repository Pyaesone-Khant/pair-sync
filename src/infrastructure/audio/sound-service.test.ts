import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SoundService } from './sound-service';

const { mockPlayerInstance } = vi.hoisted(() => ({
  mockPlayerInstance: {
    play: vi.fn(),
    pause: vi.fn(),
    release: vi.fn(),
    loop: false,
    volume: 1.0,
  },
}));

vi.mock('react-native', () => ({
  Vibration: {
    vibrate: vi.fn(),
    cancel: vi.fn(),
  },
}));

vi.mock('expo-audio', () => ({
  setAudioModeAsync: vi.fn().mockResolvedValue({}),
  createAudioPlayer: vi.fn().mockReturnValue(mockPlayerInstance),
}));

describe('SoundService (expo-audio & Clean Architecture)', () => {
  let soundService: SoundService;

  beforeEach(() => {
    vi.clearAllMocks();
    soundService = new SoundService();
  });

  it('starts incoming ringtone with looping audio and rhythmic vibration', async () => {
    await soundService.startIncomingRingtone();

    const { Vibration } = await import('react-native');
    const { setAudioModeAsync, createAudioPlayer } = await import('expo-audio');

    expect(setAudioModeAsync).toHaveBeenCalledWith({
      playsInSilentMode: true,
    });
    expect(Vibration.vibrate).toHaveBeenCalledWith([0, 1000, 1000], true);
    expect(createAudioPlayer).toHaveBeenCalled();
    expect(mockPlayerInstance.loop).toBe(true);
    expect(mockPlayerInstance.play).toHaveBeenCalled();
  });

  it('stops incoming ringtone and cancels vibration immediately', async () => {
    await soundService.startIncomingRingtone();
    await soundService.stopIncomingRingtone();

    const { Vibration } = await import('react-native');
    expect(Vibration.cancel).toHaveBeenCalled();
    expect(mockPlayerInstance.pause).toHaveBeenCalled();
    expect(mockPlayerInstance.release).toHaveBeenCalled();
  });

  it('plays one-shot message chime with gentle haptic feedback', async () => {
    await soundService.playMessageChime();

    const { Vibration } = await import('react-native');
    const { createAudioPlayer } = await import('expo-audio');

    expect(Vibration.vibrate).toHaveBeenCalledWith(60);
    expect(createAudioPlayer).toHaveBeenCalled();
    expect(mockPlayerInstance.play).toHaveBeenCalled();
  });
});
