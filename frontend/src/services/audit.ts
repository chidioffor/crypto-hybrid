import api from './api';

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  details: any;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
}

export interface AuditLogFilters {
  userId?: string;
  action?: string;
  resource?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface AuditLogResponse {
  logs: AuditLog[];
  total: number;
  hasMore: boolean;
}

export const auditService = {
  async getAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLogResponse> {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });

    const response = await api.get(`/audit/logs?${params}`);
    return response.data.data;
  },

  async getAuditLogDetails(logId: string): Promise<AuditLog> {
    const response = await api.get(`/audit/logs/${logId}`);
    return response.data.data;
  },

  async exportAuditLogs(filters: AuditLogFilters = {}, format: 'csv' | 'json' = 'csv'): Promise<Blob> {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });

    params.append('format', format);

    const response = await api.get(`/audit/export?${params}`, {
      responseType: 'blob',
    });

    return response.data;
  },
};
