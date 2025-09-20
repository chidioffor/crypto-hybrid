import api from './api';

export interface PaymentMethod {
  id: string;
  type: 'bank_account' | 'card' | 'crypto';
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentMethodRequest {
  type: 'bank_account' | 'card' | 'crypto';
  name: string;
  details: any; // Type-specific details
}

export interface CreatePaymentMethodResponse {
  paymentMethod: PaymentMethod;
  setupData?: any; // Additional setup data if needed
}

export interface SendPaymentRequest {
  paymentMethodId: string;
  amount: string;
  currency: string;
  recipient: {
    type: 'email' | 'phone' | 'address';
    value: string;
  };
  memo?: string;
}

export interface SendPaymentResponse {
  paymentId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  estimatedCompletionTime?: string;
}

export interface PaymentHistory {
  id: string;
  paymentMethodId: string;
  amount: string;
  currency: string;
  recipient: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  memo?: string;
  createdAt: string;
  updatedAt: string;
}

export const paymentService = {
  async getPaymentMethods(): Promise<PaymentMethod[]> {
    const response = await api.get('/payments/methods');
    return response.data.data;
  },

  async createPaymentMethod(data: CreatePaymentMethodRequest): Promise<CreatePaymentMethodResponse> {
    const response = await api.post('/payments/methods', data);
    return response.data.data;
  },

  async deletePaymentMethod(paymentMethodId: string): Promise<void> {
    await api.delete(`/payments/methods/${paymentMethodId}`);
  },

  async sendPayment(data: SendPaymentRequest): Promise<SendPaymentResponse> {
    const response = await api.post('/payments/send', data);
    return response.data.data;
  },

  async getPaymentHistory(limit = 50, offset = 0): Promise<PaymentHistory[]> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    const response = await api.get(`/payments/history?${params}`);
    return response.data.data;
  },

  async getPaymentStatus(paymentId: string): Promise<{ status: string; details?: any }> {
    const response = await api.get(`/payments/${paymentId}/status`);
    return response.data.data;
  },
};
