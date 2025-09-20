import api from './api';

export interface Card {
  id: string;
  userId: string;
  cardNumber: string;
  cardholderName: string;
  expiryMonth: number;
  expiryYear: number;
  cvv: string;
  type: 'virtual' | 'physical';
  status: 'active' | 'inactive' | 'blocked' | 'expired';
  spendingLimit: number;
  dailyLimit: number;
  monthlyLimit: number;
  createdAt: string;
  updatedAt: string;
}

export interface CardApplication {
  id: string;
  userId: string;
  status: 'pending' | 'approved' | 'rejected';
  type: 'virtual' | 'physical';
  requestedAt: string;
  processedAt?: string;
  rejectionReason?: string;
}

export interface ApplyForCardRequest {
  type: 'virtual' | 'physical';
  cardholderName: string;
  deliveryAddress?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
}

export interface ApplyForCardResponse {
  application: CardApplication;
}

export interface CardControls {
  spendingLimit: number;
  dailyLimit: number;
  monthlyLimit: number;
  isActive: boolean;
  allowedMerchants: string[];
  blockedMerchants: string[];
  allowedCategories: string[];
  blockedCategories: string[];
}

export interface UpdateCardControlsRequest {
  spendingLimit?: number;
  dailyLimit?: number;
  monthlyLimit?: number;
  isActive?: boolean;
  allowedMerchants?: string[];
  blockedMerchants?: string[];
  allowedCategories?: string[];
  blockedCategories?: string[];
}

export interface CardTransaction {
  id: string;
  cardId: string;
  amount: number;
  currency: string;
  merchant: string;
  category: string;
  status: 'pending' | 'completed' | 'declined';
  timestamp: string;
  location?: {
    city: string;
    country: string;
  };
}

export const cardService = {
  async getCards(): Promise<Card[]> {
    const response = await api.get('/cards');
    return response.data.data;
  },

  async applyForCard(data: ApplyForCardRequest): Promise<ApplyForCardResponse> {
    const response = await api.post('/cards/apply', data);
    return response.data.data;
  },

  async getCardApplications(): Promise<CardApplication[]> {
    const response = await api.get('/cards/applications');
    return response.data.data;
  },

  async getCardControls(cardId: string): Promise<CardControls> {
    const response = await api.get(`/cards/${cardId}/controls`);
    return response.data.data;
  },

  async updateCardControls(cardId: string, data: UpdateCardControlsRequest): Promise<CardControls> {
    const response = await api.put(`/cards/${cardId}/controls`, data);
    return response.data.data;
  },

  async blockCard(cardId: string): Promise<void> {
    await api.post(`/cards/${cardId}/block`);
  },

  async unblockCard(cardId: string): Promise<void> {
    await api.post(`/cards/${cardId}/unblock`);
  },

  async getCardTransactions(cardId: string, limit = 50, offset = 0): Promise<CardTransaction[]> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    const response = await api.get(`/cards/${cardId}/transactions?${params}`);
    return response.data.data;
  },
};
