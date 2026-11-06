import {
  INotificationPort,
  NotificationPayload,
  NotificationResponsePayload,
} from '../../application/ports/notification';

export interface IExpoNotificationsModule {
  getPermissionsAsync(): Promise<{ status: string }>;
  requestPermissionsAsync(): Promise<{ status: string }>;
  getExpoPushTokenAsync(options?: Record<string, unknown>): Promise<{ data: string }>;
  scheduleNotificationAsync(request: {
    content: {
      title?: string;
      body?: string;
      data?: Record<string, unknown>;
      sound?: boolean | string;
    };
    trigger: null | Record<string, unknown>;
  }): Promise<string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addNotificationReceivedListener(listener: (notification: any) => void): { remove(): void };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addNotificationResponseReceivedListener(listener: (response: any) => void): { remove(): void };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setNotificationHandler(handler: any): void;
}

export interface ExpoNotificationServiceDependencies {
  notificationsModule?: IExpoNotificationsModule;
  deviceModule?: { isDevice: boolean };
}

/**
 * Production implementation of INotificationPort using Expo Notifications.
 * Configures foreground notification presentation, requests OS push permissions,
 * fetches Expo push token, and registers reactive listeners.
 * Adheres to ADR 0006, ADR 0010, and Clean Architecture.
 */
export class ExpoNotificationService implements INotificationPort {
  private notificationsModule: IExpoNotificationsModule | null = null;
  private isDevice: boolean = true;

  constructor(deps: ExpoNotificationServiceDependencies = {}) {
    if (deps.notificationsModule) {
      this.notificationsModule = deps.notificationsModule;
    }
    if (deps.deviceModule) {
      this.isDevice = deps.deviceModule.isDevice;
    } else {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Device = require('expo-device');
        this.isDevice = Boolean(Device.isDevice);
      } catch {
        // Non-expo environment
      }
    }

    this.configureNotificationHandler();
  }

  private async getNotificationsModule(): Promise<IExpoNotificationsModule | null> {
    if (this.notificationsModule) return this.notificationsModule;

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('expo-notifications');
      this.notificationsModule = mod;
    } catch (err) {
      console.warn('[ExpoNotificationService] expo-notifications module unavailable:', err);
    }
    return this.notificationsModule;
  }

  private configureNotificationHandler(): void {
    if (this.notificationsModule) {
      this.notificationsModule.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
    }
  }

  public async registerForPushNotifications(): Promise<string | null> {
    if (!this.isDevice) {
      return 'ExponentPushToken[simulator-mock-token]';
    }

    const mod = await this.getNotificationsModule();
    if (!mod) {
      return null;
    }

    try {
      const { status: existingStatus } = await mod.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await mod.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('[ExpoNotificationService] Push notification permissions denied.');
        return null;
      }

      const tokenData = await mod.getExpoPushTokenAsync();
      return tokenData.data;
    } catch (err) {
      console.warn('[ExpoNotificationService] Failed to retrieve push token:', err);
      return null;
    }
  }

  public async sendLocalNotification(payload: NotificationPayload): Promise<void> {
    const mod = await this.getNotificationsModule();
    if (!mod) return;

    await mod.scheduleNotificationAsync({
      content: {
        title: payload.title,
        body: payload.body,
        data: payload.data,
        sound: payload.sound ?? true,
      },
      trigger: null,
    });
  }

  public onNotificationReceived(callback: (payload: NotificationPayload) => void): () => void {
    if (!this.notificationsModule) {
      return () => {};
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subscription = this.notificationsModule.addNotificationReceivedListener((notification: any) => {
      const content = notification?.request?.content;
      if (content) {
        callback({
          title: content.title || '',
          body: content.body || '',
          data: content.data || {},
        });
      }
    });

    return () => {
      subscription.remove();
    };
  }

  public onNotificationResponse(callback: (response: NotificationResponsePayload) => void): () => void {
    if (!this.notificationsModule) {
      return () => {};
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subscription = this.notificationsModule.addNotificationResponseReceivedListener((response: any) => {
      const content = response?.notification?.request?.content;
      callback({
        actionIdentifier: response?.actionIdentifier || 'default',
        notification: {
          title: content?.title || '',
          body: content?.body || '',
          data: content?.data || {},
        },
      });
    });

    return () => {
      subscription.remove();
    };
  }
}

// Singleton helper
let notificationServiceInstance: ExpoNotificationService | null = null;

export function getNotificationService(): ExpoNotificationService {
  if (!notificationServiceInstance) {
    notificationServiceInstance = new ExpoNotificationService();
  }
  return notificationServiceInstance;
}
