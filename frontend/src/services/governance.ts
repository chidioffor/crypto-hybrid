import api from './api';

export interface GovernanceToken {
  id: string;
  symbol: string;
  name: string;
  totalSupply: string;
  circulatingSupply: string;
  price: number;
  marketCap: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GovernanceProposal {
  id: string;
  title: string;
  description: string;
  type: 'fee_update' | 'feature_addition' | 'governance_change' | 'other';
  status: 'pending' | 'active' | 'passed' | 'rejected' | 'executed';
  proposerId: string;
  startDate: string;
  endDate: string;
  votes: {
    for: number;
    against: number;
    abstain: number;
  };
  quorum: number;
  threshold: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProposalRequest {
  title: string;
  description: string;
  type: 'fee_update' | 'feature_addition' | 'governance_change' | 'other';
  startDate: string;
  endDate: string;
}

export interface CreateProposalResponse {
  proposalId: string;
  status: 'pending' | 'active' | 'failed';
}

export interface Vote {
  id: string;
  proposalId: string;
  voterId: string;
  choice: 'for' | 'against' | 'abstain';
  weight: number;
  createdAt: string;
}

export interface CastVoteRequest {
  proposalId: string;
  choice: 'for' | 'against' | 'abstain';
}

export interface CastVoteResponse {
  voteId: string;
  status: 'pending' | 'recorded' | 'failed';
}

export interface GovernanceStats {
  totalProposals: number;
  activeProposals: number;
  totalVotes: number;
  participationRate: number;
  averageVotingPower: number;
}

export const governanceService = {
  async getGovernanceTokens(): Promise<GovernanceToken[]> {
    const response = await api.get('/governance/tokens');
    return response.data.data;
  },

  async getProposals(status?: string): Promise<GovernanceProposal[]> {
    const params = status ? `?status=${status}` : '';
    const response = await api.get(`/governance/proposals${params}`);
    return response.data.data;
  },

  async createProposal(data: CreateProposalRequest): Promise<CreateProposalResponse> {
    const response = await api.post('/governance/proposals', data);
    return response.data.data;
  },

  async getProposalDetails(proposalId: string): Promise<GovernanceProposal> {
    const response = await api.get(`/governance/proposals/${proposalId}`);
    return response.data.data;
  },

  async castVote(data: CastVoteRequest): Promise<CastVoteResponse> {
    const response = await api.post('/governance/votes', data);
    return response.data.data;
  },

  async getVotes(proposalId: string): Promise<Vote[]> {
    const response = await api.get(`/governance/proposals/${proposalId}/votes`);
    return response.data.data;
  },

  async getGovernanceStats(): Promise<GovernanceStats> {
    const response = await api.get('/governance/stats');
    return response.data.data;
  },
};
