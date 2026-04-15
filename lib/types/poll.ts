export type PollStatus = 'active' | 'inactive';

export interface PollOption {
  text: string;
  votes: number;
  percentage: number;
}

export interface PollDTO {
  id: string;
  question: string;
  options: PollOption[];
  totalVotes: number;
  status: PollStatus;
  expiresAt: string | null;
  linkedArticleId: string | null;
  createdAt: string;
  updatedAt: string;
  isExpired: boolean;
}

export interface PollStatusDTO {
  hasVoted: boolean;
  selectedOptionIndex: number | null;
}

export interface AdminPollPayload {
  question: string;
  options: string[];
  status: PollStatus;
  expiresAt: string | null;
  linkedArticleId: string | null;
}

