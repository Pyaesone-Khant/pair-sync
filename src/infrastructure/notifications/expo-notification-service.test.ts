import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ExpoNotificationService,
  IExpoNotificationsModule,
} from './expo-notification-service';

describe('ExpoNotificationService (Push & Local Alerts)', () => {
  let mockNotificationsModule: IExpoNotificationsModule;
  let mockDeviceModule: { isDevice: boolean };

  beforeEach(() => {
    mockNotificationsModule = {
      getPermissionsAsync: vi.fn().mockResolvedValue({ status: 'undetermined' }),
      requestPermissionsAsync: vi.fn().mockResolvedValue({ status: 'granted' }),
      getExpoPushTokenAsync: vi.fn().mockResolvedValue({ data: 'ExponentPushToken[mock-token-123]' }),
      scheduleNotificationAsync: vi.fn().mockResolvedValue('notification-id-abc'),
      addNotificationReceivedListener: vi.fn().mockReturnValue({ remove: vi.fn() }),
      addNotificationResponseReceivedListener: vi.fn().mockReturnValue({ remove: vi.fn() }),
      setNotificationHandler: vi.fn(),
    };

    mockDeviceModule = {
      isDevice: true,
    };
  });

  it('requests permissions and retrieves push token on physical device', async () => {
    const service = new ExpoNotificationService({
      notificationsModule: mockNotificationsModule,
      deviceModule: mockDeviceModule,
    });

    const token = await service.registerForPushNotifications();

    expect(mockNotificationsModule.requestPermissionsAsync).toHaveBeenCalled();
    expect(mockNotificationsModule.getExpoPushTokenAsync).toHaveBeenCalled();
    expect(token).toBe('ExponentPushToken[mock-token-123]');
  });

  it('returns simulator fallback token when not running on physical device', async () => {
    const service = new ExpoNotificationService({
      notificationsModule: mockNotificationsModule,
      deviceModule: { isDevice: false },
    });

    const token = await service.registerForPushNotifications();
    expect(token).toBe('ExponentPushToken[simulator-mock-token]');
    expect(mockNotificationsModule.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('returns null if permissions are denied by user on physical device', async () => {
    mockNotificationsModule.requestPermissionsAsync = vi.fn().mockResolvedValue({ status: 'denied' });

    const service = new ExpoNotificationService({
      notificationsModule: mockNotificationsModule,
      deviceModule: mockDeviceModule,
    });

    const token = await service.registerForPushNotifications();

    expect(token).toBeNull();
    expect(mockNotificationsModule.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('schedules local alert notification', async () => {
    const service = new ExpoNotificationService({
      notificationsModule: mockNotificationsModule,
      deviceModule: mockDeviceModule,
    });

    await service.sendLocalNotification({
      title: 'Partner Arrived',
      body: 'Your partner has entered Home geofence.',
      data: { type: 'geofence', placeId: 'home-123' },
    });

    expect(mockNotificationsModule.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: {
        title: 'Partner Arrived',
        body: 'Your partner has entered Home geofence.',
        data: { type: 'geofence', placeId: 'home-123' },
        sound: true,
      },
      trigger: null,
    });
  });

  it('subscribes to received notifications and triggers callback', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let capturedListener: any = null;
    mockNotificationsModule.addNotificationReceivedListener = vi.fn().mockImplementation((fn) => {
      capturedListener = fn;
      return { remove: vi.fn() };
    });

    const service = new ExpoNotificationService({
      notificationsModule: mockNotificationsModule,
      deviceModule: mockDeviceModule,
    });

    const callback = vi.fn();
    const unsubscribe = service.onNotificationReceived(callback);

    expect(mockNotificationsModule.addNotificationReceivedListener).toHaveBeenCalled();

    // Trigger fake incoming notification event
    if (typeof capturedListener === 'function') {
      capturedListener({
        request: {
          content: {
            title: 'Incoming Encrypted Message',
            body: 'New message from Partner',
            data: { sender: 'partner' },
          },
        },
      });
    }

    expect(callback).toHaveBeenCalledWith({
      title: 'Incoming Encrypted Message',
      body: 'New message from Partner',
      data: { sender: 'partner' },
    });

    unsubscribe();
  });
});
