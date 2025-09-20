import api from './api';

export interface Loan {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  interestRate: number;
  term: number; // in months
  status: 'pending' | 'approved' | 'active' | 'completed' | 'defaulted';
  collateral: {
    assetId: string;
    amount: string;
    value: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface LoanApplication {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  term: number;
  collateral: {
    assetId: string;
    amount: string;
  };
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  processedAt?: string;
  rejectionReason?: string;
}

export interface ApplyForLoanRequest {
  amount: number;
  currency: string;
  term: number;
  collateral: {
    assetId: string;
    amount: string;
  };
}

export interface ApplyForLoanResponse {
  application: LoanApplication;
  estimatedInterestRate: number;
  estimatedMonthlyPayment: number;
}

export interface LoanPayment {
  id: string;
  loanId: string;
  amount: number;
  currency: string;
  dueDate: string;
  status: 'pending' | 'paid' | 'overdue';
  paidAt?: string;
}

export interface MakePaymentRequest {
  loanId: string;
  amount: number;
  paymentMethodId: string;
}

export interface MakePaymentResponse {
  paymentId: string;
  status: 'pending' | 'completed' | 'failed';
}

export const loanService = {
  async getLoans(): Promise<Loan[]> {
    const response = await api.get('/loans');
    return response.data.data;
  },

  async applyForLoan(data: ApplyForLoanRequest): Promise<ApplyForLoanResponse> {
    const response = await api.post('/loans/apply', data);
    return response.data.data;
  },

  async getLoanApplications(): Promise<LoanApplication[]> {
    const response = await api.get('/loans/applications');
    return response.data.data;
  },

  async getLoanPayments(loanId: string): Promise<LoanPayment[]> {
    const response = await api.get(`/loans/${loanId}/payments`);
    return response.data.data;
  },

  async makePayment(data: MakePaymentRequest): Promise<MakePaymentResponse> {
    const response = await api.post('/loans/payments', data);
    return response.data.data;
  },

  async getLoanDetails(loanId: string): Promise<Loan> {
    const response = await api.get(`/loans/${loanId}`);
    return response.data.data;
  },
};
