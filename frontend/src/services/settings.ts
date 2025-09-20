import api from './api';

export interface UserSettings {
  profile: {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    dateOfBirth: string;
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
  };
  preferences: {
    language: string;
    timezone: string;
    currency: string;
    dateFormat: string;
    timeFormat: '12h' | '24h';
    theme: 'light' | 'dark' | 'auto';
  };
  notifications: {
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
  };
  privacy: {
    profileVisibility: 'public' | 'private' | 'friends';
    showBalance: boolean;
    showTransactions: boolean;
    allowDataSharing: boolean;
    marketingEmails: boolean;
  };
  security: {
    twoFactorEnabled: boolean;
    twoFactorMethod: 'sms' | 'email' | 'authenticator' | 'none';
    loginNotifications: boolean;
    transactionNotifications: boolean;
    ipWhitelist: string[];
    sessionTimeout: number;
    passwordExpiry: number;
    maxLoginAttempts: number;
    lockoutDuration: number;
  };
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
}

export interface UpdatePreferencesRequest {
  language?: string;
  timezone?: string;
  currency?: string;
  dateFormat?: string;
  timeFormat?: '12h' | '24h';
  theme?: 'light' | 'dark' | 'auto';
}

export interface UpdateNotificationsRequest {
  email?: Partial<UserSettings['notifications']['email']>;
  push?: Partial<UserSettings['notifications']['push']>;
  sms?: Partial<UserSettings['notifications']['sms']>;
}

export interface UpdatePrivacyRequest {
  profileVisibility?: 'public' | 'private' | 'friends';
  showBalance?: boolean;
  showTransactions?: boolean;
  allowDataSharing?: boolean;
  marketingEmails?: boolean;
}

export const settingsService = {
  async getUserSettings(): Promise<UserSettings> {
    const response = await api.get('/settings');
    return response.data.data;
  },

  async updateProfile(data: UpdateProfileRequest): Promise<UserSettings> {
    const response = await api.put('/settings/profile', data);
    return response.data.data;
  },

  async updatePreferences(data: UpdatePreferencesRequest): Promise<UserSettings> {
    const response = await api.put('/settings/preferences', data);
    return response.data.data;
  },

  async updateNotifications(data: UpdateNotificationsRequest): Promise<UserSettings> {
    const response = await api.put('/settings/notifications', data);
    return response.data.data;
  },

  async updatePrivacy(data: UpdatePrivacyRequest): Promise<UserSettings> {
    const response = await api.put('/settings/privacy', data);
    return response.data.data;
  },

  async updateSecurity(data: Partial<UserSettings['security']>): Promise<UserSettings> {
    const response = await api.put('/settings/security', data);
    return response.data.data;
  },

  async deleteAccount(password: string): Promise<void> {
    await api.delete('/settings/account', {
      data: { password },
    });
  },
};
