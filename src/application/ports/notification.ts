export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: boolean | string;
}

export interface NotificationResponsePayload {
  actionIdentifier: string;
  notification: NotificationPayload;
}

/**
 * Port interface for push and local notifications.
 * Decouples notification delivery and token management from expo-notifications.
 * Adheres to ADR 0006 and ADR 0010.
 */
export interface INotificationPort {
  /**
   * Requests notification permissions from device OS and returns push token.
   */
  registerForPushNotifications(): Promise<string | null>;

  /**
   * Dispatches an immediate local push notification banner.
   */
  sendLocalNotification(payload: NotificationPayload): Promise<void>;

  /**
   * Subscribes to foreground incoming notifications.
   */
  onNotificationReceived(callback: (payload: NotificationPayload) => void): () => void;

  /**
   * Subscribes to notification interaction / tap events.
   */
  onNotificationResponse(callback: (response: NotificationResponsePayload) => void): () => void;
}
