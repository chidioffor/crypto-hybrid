import api from './api';

export interface Backup {
  id: string;
  userId: string;
  type: 'wallet' | 'transactions' | 'documents' | 'full';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  size: number;
  createdAt: string;
  completedAt?: string;
  downloadUrl?: string;
  expiresAt?: string;
}

export interface CreateBackupRequest {
  type: 'wallet' | 'transactions' | 'documents' | 'full';
  includePrivateKeys?: boolean;
  password?: string;
}

export interface CreateBackupResponse {
  backupId: string;
  status: 'pending' | 'in_progress' | 'failed';
}

export interface RestoreBackupRequest {
  backupId: string;
  password?: string;
  confirmRestore: boolean;
}

export interface RestoreBackupResponse {
  restoreId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export const backupService = {
  async getBackups(): Promise<Backup[]> {
    const response = await api.get('/backup');
    return response.data.data;
  },

  async createBackup(data: CreateBackupRequest): Promise<CreateBackupResponse> {
    const response = await api.post('/backup', data);
    return response.data.data;
  },

  async getBackupDetails(backupId: string): Promise<Backup> {
    const response = await api.get(`/backup/${backupId}`);
    return response.data.data;
  },

  async downloadBackup(backupId: string): Promise<Blob> {
    const response = await api.get(`/backup/${backupId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  async restoreBackup(data: RestoreBackupRequest): Promise<RestoreBackupResponse> {
    const response = await api.post('/backup/restore', data);
    return response.data.data;
  },

  async deleteBackup(backupId: string): Promise<void> {
    await api.delete(`/backup/${backupId}`);
  },
};
