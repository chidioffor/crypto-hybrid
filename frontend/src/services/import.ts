import api from './api';

export interface ImportRequest {
  type: 'transactions' | 'portfolio' | 'documents';
  format: 'csv' | 'xlsx' | 'json';
  file: File;
  mapping?: {
    [key: string]: string;
  };
  options?: {
    skipDuplicates?: boolean;
    validateData?: boolean;
    dryRun?: boolean;
  };
}

export interface ImportResponse {
  importId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  totalRecords: number;
  processedRecords: number;
  errors: {
    row: number;
    field: string;
    message: string;
  }[];
  summary?: {
    imported: number;
    skipped: number;
    errors: number;
  };
}

export interface ImportStatus {
  id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  totalRecords: number;
  processedRecords: number;
  errors: {
    row: number;
    field: string;
    message: string;
  }[];
  summary?: {
    imported: number;
    skipped: number;
    errors: number;
  };
}

export const importService = {
  async createImport(data: ImportRequest): Promise<ImportResponse> {
    const formData = new FormData();
    formData.append('type', data.type);
    formData.append('format', data.format);
    formData.append('file', data.file);
    
    if (data.mapping) {
      formData.append('mapping', JSON.stringify(data.mapping));
    }
    
    if (data.options) {
      formData.append('options', JSON.stringify(data.options));
    }

    const response = await api.post('/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data;
  },

  async getImportStatus(importId: string): Promise<ImportStatus> {
    const response = await api.get(`/import/${importId}/status`);
    return response.data.data;
  },

  async getImportHistory(): Promise<ImportResponse[]> {
    const response = await api.get('/import/history');
    return response.data.data;
  },

  async deleteImport(importId: string): Promise<void> {
    await api.delete(`/import/${importId}`);
  },
};
