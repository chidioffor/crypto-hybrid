import api from './api';

export interface SupportTicket {
  id: string;
  userId: string;
  subject: string;
  description: string;
  category: 'technical' | 'account' | 'billing' | 'security' | 'general';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  attachments: {
    id: string;
    name: string;
    url: string;
    uploadedAt: string;
  }[];
  messages: {
    id: string;
    senderId: string;
    senderType: 'user' | 'support';
    message: string;
    attachments?: {
      id: string;
      name: string;
      url: string;
    }[];
    createdAt: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupportTicketRequest {
  subject: string;
  description: string;
  category: 'technical' | 'account' | 'billing' | 'security' | 'general';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  attachments?: File[];
}

export interface CreateSupportTicketResponse {
  ticketId: string;
  status: 'pending' | 'created' | 'failed';
}

export interface AddMessageRequest {
  ticketId: string;
  message: string;
  attachments?: File[];
}

export interface AddMessageResponse {
  messageId: string;
  status: 'pending' | 'added' | 'failed';
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: 'general' | 'account' | 'security' | 'transactions' | 'cards' | 'loans' | 'investments';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const supportService = {
  async getSupportTickets(status?: string): Promise<SupportTicket[]> {
    const params = status ? `?status=${status}` : '';
    const response = await api.get(`/support/tickets${params}`);
    return response.data.data;
  },

  async createSupportTicket(data: CreateSupportTicketRequest): Promise<CreateSupportTicketResponse> {
    const formData = new FormData();
    formData.append('subject', data.subject);
    formData.append('description', data.description);
    formData.append('category', data.category);
    formData.append('priority', data.priority);
    
    if (data.attachments) {
      data.attachments.forEach((file, index) => {
        formData.append(`attachments[${index}]`, file);
      });
    }

    const response = await api.post('/support/tickets', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data;
  },

  async getSupportTicketDetails(ticketId: string): Promise<SupportTicket> {
    const response = await api.get(`/support/tickets/${ticketId}`);
    return response.data.data;
  },

  async addMessage(data: AddMessageRequest): Promise<AddMessageResponse> {
    const formData = new FormData();
    formData.append('ticketId', data.ticketId);
    formData.append('message', data.message);
    
    if (data.attachments) {
      data.attachments.forEach((file, index) => {
        formData.append(`attachments[${index}]`, file);
      });
    }

    const response = await api.post('/support/messages', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data;
  },

  async getFAQs(category?: string): Promise<FAQ[]> {
    const params = category ? `?category=${category}` : '';
    const response = await api.get(`/support/faqs${params}`);
    return response.data.data;
  },
};
