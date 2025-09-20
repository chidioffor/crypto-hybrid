import api from './api';

export interface SecuritySettings {
  twoFactorEnabled: boolean;
  twoFactorMethod: 'sms' | 'email' | 'authenticator' | 'none';
  loginNotifications: boolean;
  transactionNotifications: boolean;
  ipWhitelist: string[];
  sessionTimeout: number; // in minutes
  passwordExpiry: number; // in days
  maxLoginAttempts: number;
  lockoutDuration: number; // in minutes
}

export interface SecurityEvent {
  id: string;
  type: 'login' | 'logout' | 'failed_login' | 'password_change' | '2fa_enabled' | '2fa_disabled' | 'suspicious_activity';
  description: string;
  ipAddress: string;
  userAgent: string;
  location?: {
    city: string;
    country: string;
  };
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface Enable2FARequest {
  method: 'sms' | 'email' | 'authenticator';
  phoneNumber?: string;
  email?: string;
}

export interface Enable2FAResponse {
  qrCode?: string;
  secret?: string;
  backupCodes: string[];
  status: 'pending' | 'enabled' | 'failed';
}

export interface Verify2FARequest {
  code: string;
  method: 'sms' | 'email' | 'authenticator';
}

export interface Verify2FAResponse {
  status: 'verified' | 'failed';
  backupCodes?: string[];
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangePasswordResponse {
  status: 'success' | 'failed';
  message: string;
}

export const securityService = {
  async getSecuritySettings(): Promise<SecuritySettings> {
    const response = await api.get('/security/settings');
    return response.data.data;
  },

  async updateSecuritySettings(data: Partial<SecuritySettings>): Promise<SecuritySettings> {
    const response = await api.put('/security/settings', data);
    return response.data.data;
  },

  async getSecurityEvents(limit = 50, offset = 0): Promise<SecurityEvent[]> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    const response = await api.get(`/security/events?${params}`);
    return response.data.data;
  },

  async enable2FA(data: Enable2FARequest): Promise<Enable2FAResponse> {
    const response = await api.post('/security/2fa/enable', data);
    return response.data.data;
  },

  async verify2FA(data: Verify2FARequest): Promise<Verify2FAResponse> {
    const response = await api.post('/security/2fa/verify', data);
    return response.data.data;
  },

  async disable2FA(): Promise<void> {
    await api.post('/security/2fa/disable');
  },

  async changePassword(data: ChangePasswordRequest): Promise<ChangePasswordResponse> {
    const response = await api.post('/security/change-password', data);
    return response.data.data;
  },

  async getActiveSessions(): Promise<any[]> {
    const response = await api.get('/security/sessions');
    return response.data.data;
  },

  async terminateSession(sessionId: string): Promise<void> {
    await api.delete(`/security/sessions/${sessionId}`);
  },

  async terminateAllSessions(): Promise<void> {
    await api.delete('/security/sessions/all');
  },
};
