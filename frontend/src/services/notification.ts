import api from './api';

export interface Notification {
  id: string;
  userId: string;
  type: 'transaction' | 'security' | 'kyc' | 'card' | 'loan' | 'investment' | 'governance' | 'system';
  title: string;
  message: string;
  isRead: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  data?: any;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationSettings {
  email: {
    transactions: boolean;
    security: boolean;
    kyc: boolean;
    cards: boolean;
    loans: boolean;
    investments: boolean;
    governance: boolean;
    system: boolean;
  };
  push: {
    transactions: boolean;
    security: boolean;
    kyc: boolean;
    cards: boolean;
    loans: boolean;
    investments: boolean;
    governance: boolean;
    system: boolean;
  };
  sms: {
    security: boolean;
    kyc: boolean;
    cards: boolean;
    loans: boolean;
  };
}

export interface UpdateNotificationSettingsRequest {
  email?: Partial<NotificationSettings['email']>;
  push?: Partial<NotificationSettings['push']>;
  sms?: Partial<NotificationSettings['sms']>;
}

export const notificationService = {
  async getNotifications(limit = 50, offset = 0): Promise<Notification[]> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    const response = await api.get(`/notifications?${params}`);
    return response.data.data;
  },

  async markAsRead(notificationId: string): Promise<void> {
    await api.put(`/notifications/${notificationId}/read`);
  },

  async markAllAsRead(): Promise<void> {
    await api.put('/notifications/read-all');
  },

  async deleteNotification(notificationId: string): Promise<void> {
    await api.delete(`/notifications/${notificationId}`);
  },

  async getNotificationSettings(): Promise<NotificationSettings> {
    const response = await api.get('/notifications/settings');
    return response.data.data;
  },

  async updateNotificationSettings(data: UpdateNotificationSettingsRequest): Promise<NotificationSettings> {
    const response = await api.put('/notifications/settings', data);
    return response.data.data;
  },
};
