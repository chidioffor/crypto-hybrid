import api from './api';

export interface LetterOfCredit {
  id: string;
  issuerId: string;
  beneficiaryId: string;
  amount: string;
  currency: string;
  status: 'pending' | 'issued' | 'accepted' | 'completed' | 'cancelled';
  conditions: string[];
  documents: {
    id: string;
    name: string;
    url: string;
    uploadedAt: string;
  }[];
  expiryDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLetterOfCreditRequest {
  beneficiaryId: string;
  amount: string;
  currency: string;
  conditions: string[];
  expiryDate: string;
  documents?: File[];
}

export interface CreateLetterOfCreditResponse {
  lcId: string;
  status: 'pending' | 'issued' | 'failed';
}

export interface LetterOfCreditMilestone {
  id: string;
  lcId: string;
  description: string;
  status: 'pending' | 'completed' | 'rejected';
  completedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

export interface CompleteLCMilestoneRequest {
  milestoneId: string;
  proof: string;
  documents?: File[];
}

export interface CompleteLCMilestoneResponse {
  milestoneId: string;
  status: 'pending' | 'completed' | 'rejected';
}

export const letterOfCreditService = {
  async getLettersOfCredit(): Promise<LetterOfCredit[]> {
    const response = await api.get('/letters-of-credit');
    return response.data.data;
  },

  async createLetterOfCredit(data: CreateLetterOfCreditRequest): Promise<CreateLetterOfCreditResponse> {
    const formData = new FormData();
    formData.append('beneficiaryId', data.beneficiaryId);
    formData.append('amount', data.amount);
    formData.append('currency', data.currency);
    formData.append('conditions', JSON.stringify(data.conditions));
    formData.append('expiryDate', data.expiryDate);
    
    if (data.documents) {
      data.documents.forEach((doc, index) => {
        formData.append(`documents[${index}]`, doc);
      });
    }

    const response = await api.post('/letters-of-credit', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data;
  },

  async getLetterOfCreditDetails(lcId: string): Promise<LetterOfCredit> {
    const response = await api.get(`/letters-of-credit/${lcId}`);
    return response.data.data;
  },

  async getLCMilestones(lcId: string): Promise<LetterOfCreditMilestone[]> {
    const response = await api.get(`/letters-of-credit/${lcId}/milestones`);
    return response.data.data;
  },

  async completeLCMilestone(data: CompleteLCMilestoneRequest): Promise<CompleteLCMilestoneResponse> {
    const formData = new FormData();
    formData.append('milestoneId', data.milestoneId);
    formData.append('proof', data.proof);
    
    if (data.documents) {
      data.documents.forEach((doc, index) => {
        formData.append(`documents[${index}]`, doc);
      });
    }

    const response = await api.post('/letters-of-credit/milestones/complete', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data;
  },

  async acceptLetterOfCredit(lcId: string): Promise<void> {
    await api.post(`/letters-of-credit/${lcId}/accept`);
  },

  async cancelLetterOfCredit(lcId: string): Promise<void> {
    await api.post(`/letters-of-credit/${lcId}/cancel`);
  },
};
