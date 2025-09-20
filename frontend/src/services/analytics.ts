import api from './api';

export interface AnalyticsData {
  period: 'day' | 'week' | 'month' | 'year';
  startDate: string;
  endDate: string;
  data: {
    date: string;
    value: number;
    label?: string;
  }[];
}

export interface PortfolioAnalytics {
  totalValue: number;
  totalReturn: number;
  returnPercentage: number;
  assetAllocation: {
    assetId: string;
    symbol: string;
    value: number;
    percentage: number;
  }[];
  performance: AnalyticsData;
  riskMetrics: {
    volatility: number;
    sharpeRatio: number;
    maxDrawdown: number;
  };
}

export interface TransactionAnalytics {
  totalTransactions: number;
  totalVolume: number;
  averageTransactionSize: number;
  transactionTypes: {
    type: string;
    count: number;
    volume: number;
  }[];
  monthlyTrend: AnalyticsData;
  topAssets: {
    assetId: string;
    symbol: string;
    volume: number;
    count: number;
  }[];
}

export interface CardAnalytics {
  totalSpending: number;
  averageTransactionSize: number;
  spendingByCategory: {
    category: string;
    amount: number;
    percentage: number;
  }[];
  monthlyTrend: AnalyticsData;
  topMerchants: {
    merchant: string;
    amount: number;
    count: number;
  }[];
}

export interface InvestmentAnalytics {
  totalInvested: number;
  totalReturn: number;
  returnPercentage: number;
  activeInvestments: number;
  investmentTypes: {
    type: string;
    count: number;
    value: number;
    return: number;
  }[];
  performance: AnalyticsData;
}

export const analyticsService = {
  async getPortfolioAnalytics(period: 'day' | 'week' | 'month' | 'year' = 'month'): Promise<PortfolioAnalytics> {
    const response = await api.get(`/analytics/portfolio?period=${period}`);
    return response.data.data;
  },

  async getTransactionAnalytics(period: 'day' | 'week' | 'month' | 'year' = 'month'): Promise<TransactionAnalytics> {
    const response = await api.get(`/analytics/transactions?period=${period}`);
    return response.data.data;
  },

  async getCardAnalytics(period: 'day' | 'week' | 'month' | 'year' = 'month'): Promise<CardAnalytics> {
    const response = await api.get(`/analytics/cards?period=${period}`);
    return response.data.data;
  },

  async getInvestmentAnalytics(period: 'day' | 'week' | 'month' | 'year' = 'month'): Promise<InvestmentAnalytics> {
    const response = await api.get(`/analytics/investments?period=${period}`);
    return response.data.data;
  },

  async getCustomAnalytics(
    type: string,
    period: 'day' | 'week' | 'month' | 'year' = 'month',
    filters?: any
  ): Promise<AnalyticsData> {
    const params = new URLSearchParams({
      type,
      period,
    });

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        params.append(key, value as string);
      });
    }

    const response = await api.get(`/analytics/custom?${params}`);
    return response.data.data;
  },
};
