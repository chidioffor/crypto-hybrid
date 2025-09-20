import api from './api';

export interface Escrow {
  id: string;
  creatorId: string;
  beneficiaryId: string;
  amount: string;
  assetId: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  conditions: string[];
  documents: {
    id: string;
    name: string;
    url: string;
    uploadedAt: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateEscrowRequest {
  beneficiaryId: string;
  amount: string;
  assetId: string;
  conditions: string[];
  documents?: File[];
}

export interface CreateEscrowResponse {
  escrowId: string;
  status: 'pending' | 'active' | 'failed';
}

export interface EscrowMilestone {
  id: string;
  escrowId: string;
  description: string;
  status: 'pending' | 'completed' | 'rejected';
  completedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

export interface CompleteMilestoneRequest {
  milestoneId: string;
  proof: string;
  documents?: File[];
}

export interface CompleteMilestoneResponse {
  milestoneId: string;
  status: 'pending' | 'completed' | 'rejected';
}

export const escrowService = {
  async getEscrows(): Promise<Escrow[]> {
    const response = await api.get('/escrows');
    return response.data.data;
  },

  async createEscrow(data: CreateEscrowRequest): Promise<CreateEscrowResponse> {
    const formData = new FormData();
    formData.append('beneficiaryId', data.beneficiaryId);
    formData.append('amount', data.amount);
    formData.append('assetId', data.assetId);
    formData.append('conditions', JSON.stringify(data.conditions));
    
    if (data.documents) {
      data.documents.forEach((doc, index) => {
        formData.append(`documents[${index}]`, doc);
      });
    }

    const response = await api.post('/escrows', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data;
  },

  async getEscrowDetails(escrowId: string): Promise<Escrow> {
    const response = await api.get(`/escrows/${escrowId}`);
    return response.data.data;
  },

  async getEscrowMilestones(escrowId: string): Promise<EscrowMilestone[]> {
    const response = await api.get(`/escrows/${escrowId}/milestones`);
    return response.data.data;
  },

  async completeMilestone(data: CompleteMilestoneRequest): Promise<CompleteMilestoneResponse> {
    const formData = new FormData();
    formData.append('milestoneId', data.milestoneId);
    formData.append('proof', data.proof);
    
    if (data.documents) {
      data.documents.forEach((doc, index) => {
        formData.append(`documents[${index}]`, doc);
      });
    }

    const response = await api.post('/escrows/milestones/complete', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data;
  },

  async cancelEscrow(escrowId: string): Promise<void> {
    await api.post(`/escrows/${escrowId}/cancel`);
  },
};
