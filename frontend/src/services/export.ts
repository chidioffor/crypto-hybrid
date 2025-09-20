import api from './api';

export interface ExportRequest {
  type: 'transactions' | 'tax' | 'portfolio' | 'documents' | 'full';
  format: 'csv' | 'xlsx' | 'pdf' | 'json';
  dateRange: {
    startDate: string;
    endDate: string;
  };
  filters?: {
    assetIds?: string[];
    transactionTypes?: string[];
    statuses?: string[];
  };
  includePrivateKeys?: boolean;
  password?: string;
}

export interface ExportResponse {
  exportId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  estimatedCompletionTime?: string;
  downloadUrl?: string;
  expiresAt?: string;
}

export interface ExportStatus {
  id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  downloadUrl?: string;
  expiresAt?: string;
  error?: string;
}

export const exportService = {
  async createExport(data: ExportRequest): Promise<ExportResponse> {
    const response = await api.post('/export', data);
    return response.data.data;
  },

  async getExportStatus(exportId: string): Promise<ExportStatus> {
    const response = await api.get(`/export/${exportId}/status`);
    return response.data.data;
  },

  async downloadExport(exportId: string): Promise<Blob> {
    const response = await api.get(`/export/${exportId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  async getExportHistory(): Promise<ExportResponse[]> {
    const response = await api.get('/export/history');
    return response.data.data;
  },

  async deleteExport(exportId: string): Promise<void> {
    await api.delete(`/export/${exportId}`);
  },
};
