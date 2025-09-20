import api from './api';

export interface Investment {
  id: string;
  userId: string;
  type: 'staking' | 'yield_farming' | 'liquidity_pool' | 'robo_advisory';
  assetId: string;
  amount: string;
  apy: number;
  status: 'active' | 'completed' | 'cancelled';
  startDate: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StakingPool {
  id: string;
  assetId: string;
  name: string;
  apy: number;
  minStake: string;
  maxStake: string;
  lockPeriod: number; // in days
  isActive: boolean;
  totalStaked: string;
  totalRewards: string;
}

export interface YieldFarm {
  id: string;
  name: string;
  assetIds: string[];
  apy: number;
  minDeposit: string;
  isActive: boolean;
  totalLiquidity: string;
  totalRewards: string;
}

export interface RoboAdvisoryPortfolio {
  id: string;
  userId: string;
  name: string;
  riskLevel: 'conservative' | 'moderate' | 'aggressive';
  targetReturn: number;
  currentValue: number;
  totalInvested: number;
  totalReturn: number;
  returnPercentage: number;
  assets: {
    assetId: string;
    allocation: number;
    value: number;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateStakingRequest {
  poolId: string;
  amount: string;
}

export interface CreateStakingResponse {
  stakingId: string;
  status: 'pending' | 'active' | 'failed';
}

export interface CreateYieldFarmingRequest {
  farmId: string;
  amount: string;
}

export interface CreateYieldFarmingResponse {
  farmingId: string;
  status: 'pending' | 'active' | 'failed';
}

export interface CreateRoboAdvisoryRequest {
  name: string;
  riskLevel: 'conservative' | 'moderate' | 'aggressive';
  targetReturn: number;
  initialAmount: number;
}

export interface CreateRoboAdvisoryResponse {
  portfolioId: string;
  status: 'pending' | 'active' | 'failed';
}

export const investmentService = {
  async getInvestments(): Promise<Investment[]> {
    const response = await api.get('/investments');
    return response.data.data;
  },

  async getStakingPools(): Promise<StakingPool[]> {
    const response = await api.get('/investments/staking/pools');
    return response.data.data;
  },

  async createStaking(data: CreateStakingRequest): Promise<CreateStakingResponse> {
    const response = await api.post('/investments/staking', data);
    return response.data.data;
  },

  async getYieldFarms(): Promise<YieldFarm[]> {
    const response = await api.get('/investments/yield-farming/farms');
    return response.data.data;
  },

  async createYieldFarming(data: CreateYieldFarmingRequest): Promise<CreateYieldFarmingResponse> {
    const response = await api.post('/investments/yield-farming', data);
    return response.data.data;
  },

  async getRoboAdvisoryPortfolios(): Promise<RoboAdvisoryPortfolio[]> {
    const response = await api.get('/investments/robo-advisory/portfolios');
    return response.data.data;
  },

  async createRoboAdvisory(data: CreateRoboAdvisoryRequest): Promise<CreateRoboAdvisoryResponse> {
    const response = await api.post('/investments/robo-advisory', data);
    return response.data.data;
  },

  async getInvestmentHistory(investmentId: string): Promise<any[]> {
    const response = await api.get(`/investments/${investmentId}/history`);
    return response.data.data;
  },
};
