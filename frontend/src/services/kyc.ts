import api from './api';

export interface KYCStatus {
  status: 'pending' | 'approved' | 'rejected' | 'requires_verification';
  documents: {
    id: string;
    type: 'passport' | 'drivers_license' | 'national_id' | 'utility_bill' | 'bank_statement';
    status: 'pending' | 'approved' | 'rejected';
    uploadedAt: string;
    reviewedAt?: string;
    rejectionReason?: string;
  }[];
  verificationLevel: 'basic' | 'enhanced' | 'premium';
  limits: {
    daily: number;
    monthly: number;
    yearly: number;
  };
  lastUpdated: string;
}

export interface UploadDocumentRequest {
  type: 'passport' | 'drivers_license' | 'national_id' | 'utility_bill' | 'bank_statement';
  file: File;
}

export interface UploadDocumentResponse {
  documentId: string;
  status: 'pending' | 'uploaded' | 'failed';
}

export interface KYCVerificationRequest {
  documentType: 'passport' | 'drivers_license' | 'national_id';
  documentNumber: string;
  country: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
}

export interface KYCVerificationResponse {
  verificationId: string;
  status: 'pending' | 'verified' | 'failed';
  confidence: number;
}

export const kycService = {
  async getKYCStatus(): Promise<KYCStatus> {
    const response = await api.get('/kyc/status');
    return response.data.data;
  },

  async uploadDocument(data: UploadDocumentRequest): Promise<UploadDocumentResponse> {
    const formData = new FormData();
    formData.append('type', data.type);
    formData.append('file', data.file);

    const response = await api.post('/kyc/documents', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data;
  },

  async verifyIdentity(data: KYCVerificationRequest): Promise<KYCVerificationResponse> {
    const response = await api.post('/kyc/verify', data);
    return response.data.data;
  },

  async getVerificationHistory(): Promise<any[]> {
    const response = await api.get('/kyc/verification-history');
    return response.data.data;
  },
};
