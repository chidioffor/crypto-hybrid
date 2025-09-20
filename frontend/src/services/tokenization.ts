import api from './api';

export interface TokenizedAsset {
  id: string;
  ownerId: string;
  name: string;
  symbol: string;
  description: string;
  type: 'real_estate' | 'precious_metals' | 'art' | 'collectibles' | 'other';
  totalSupply: string;
  pricePerToken: number;
  totalValue: number;
  status: 'pending' | 'active' | 'paused' | 'cancelled';
  documents: {
    id: string;
    name: string;
    url: string;
    uploadedAt: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTokenizedAssetRequest {
  name: string;
  symbol: string;
  description: string;
  type: 'real_estate' | 'precious_metals' | 'art' | 'collectibles' | 'other';
  totalSupply: string;
  pricePerToken: number;
  documents: File[];
}

export interface CreateTokenizedAssetResponse {
  assetId: string;
  status: 'pending' | 'active' | 'failed';
}

export interface TokenizedAssetListing {
  id: string;
  assetId: string;
  sellerId: string;
  amount: string;
  pricePerToken: number;
  status: 'active' | 'sold' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface CreateListingRequest {
  assetId: string;
  amount: string;
  pricePerToken: number;
}

export interface CreateListingResponse {
  listingId: string;
  status: 'pending' | 'active' | 'failed';
}

export interface TokenizedAssetTrade {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  amount: string;
  pricePerToken: number;
  totalValue: number;
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface CreateTradeRequest {
  listingId: string;
  amount: string;
}

export interface CreateTradeResponse {
  tradeId: string;
  status: 'pending' | 'completed' | 'failed';
}

export const tokenizationService = {
  async getTokenizedAssets(): Promise<TokenizedAsset[]> {
    const response = await api.get('/tokenized-assets');
    return response.data.data;
  },

  async createTokenizedAsset(data: CreateTokenizedAssetRequest): Promise<CreateTokenizedAssetResponse> {
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('symbol', data.symbol);
    formData.append('description', data.description);
    formData.append('type', data.type);
    formData.append('totalSupply', data.totalSupply);
    formData.append('pricePerToken', data.pricePerToken.toString());
    
    data.documents.forEach((doc, index) => {
      formData.append(`documents[${index}]`, doc);
    });

    const response = await api.post('/tokenized-assets', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data;
  },

  async getTokenizedAssetDetails(assetId: string): Promise<TokenizedAsset> {
    const response = await api.get(`/tokenized-assets/${assetId}`);
    return response.data.data;
  },

  async getListings(assetId?: string): Promise<TokenizedAssetListing[]> {
    const params = assetId ? `?assetId=${assetId}` : '';
    const response = await api.get(`/tokenized-assets/listings${params}`);
    return response.data.data;
  },

  async createListing(data: CreateListingRequest): Promise<CreateListingResponse> {
    const response = await api.post('/tokenized-assets/listings', data);
    return response.data.data;
  },

  async getTrades(listingId?: string): Promise<TokenizedAssetTrade[]> {
    const params = listingId ? `?listingId=${listingId}` : '';
    const response = await api.get(`/tokenized-assets/trades${params}`);
    return response.data.data;
  },

  async createTrade(data: CreateTradeRequest): Promise<CreateTradeResponse> {
    const response = await api.post('/tokenized-assets/trades', data);
    return response.data.data;
  },
};
