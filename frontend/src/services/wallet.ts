import api from './api';

export interface Wallet {
  id: string;
  userId: string;
  address: string;
  type: 'custodial' | 'non-custodial';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  type: 'crypto' | 'fiat';
  decimals: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Balance {
  id: string;
  walletId: string;
  assetId: string;
  amount: string;
  lockedAmount: string;
  asset: Asset;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWalletRequest {
  type: 'custodial' | 'non-custodial';
}

export interface CreateWalletResponse {
  wallet: Wallet;
  mnemonic?: string; // Only for non-custodial wallets
}

export interface SendTransactionRequest {
  walletId: string;
  assetId: string;
  amount: string;
  toAddress: string;
  memo?: string;
}

export interface SendTransactionResponse {
  transactionId: string;
  status: 'pending' | 'confirmed' | 'failed';
}

export interface SwapRequest {
  fromAssetId: string;
  toAssetId: string;
  amount: string;
  slippageTolerance: number;
}

export interface SwapResponse {
  swapId: string;
  estimatedOutput: string;
  priceImpact: number;
  status: 'pending' | 'completed' | 'failed';
}

export const walletService = {
  async getWallets(): Promise<Wallet[]> {
    const response = await api.get('/wallets');
    return response.data.data;
  },

  async createWallet(data: CreateWalletRequest): Promise<CreateWalletResponse> {
    const response = await api.post('/wallets', data);
    return response.data.data;
  },

  async getWalletBalances(walletId: string): Promise<Balance[]> {
    const response = await api.get(`/wallets/${walletId}/balances`);
    return response.data.data;
  },

  async getAllBalances(): Promise<Balance[]> {
    const response = await api.get('/wallets/balances');
    return response.data.data;
  },

  async getAssets(): Promise<Asset[]> {
    const response = await api.get('/assets');
    return response.data.data;
  },

  async sendTransaction(data: SendTransactionRequest): Promise<SendTransactionResponse> {
    const response = await api.post('/wallets/send', data);
    return response.data.data;
  },

  async swapAssets(data: SwapRequest): Promise<SwapResponse> {
    const response = await api.post('/wallets/swap', data);
    return response.data.data;
  },

  async getTransactionHistory(walletId?: string, limit = 50, offset = 0): Promise<any[]> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });
    
    if (walletId) {
      params.append('walletId', walletId);
    }

    const response = await api.get(`/wallets/transactions?${params}`);
    return response.data.data;
  },
};
