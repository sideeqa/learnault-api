import { AssetIdentity } from '../utils/money'

export enum TransactionType {
  EARNED = 'earned',
  SPENT = 'spent',
  TRANSFERRED = 'transferred',
  REFUNDED = 'refunded',
  BONUS = 'bonus',
}

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REVERSED = 'reversed',
}

export enum TransactionReason {
  MODULE_COMPLETION = 'module_completion',
  CREDENTIAL_ISSUED = 'credential_issued',
  REFERRAL_BONUS = 'referral_bonus',
  STREAK_BONUS = 'streak_bonus',
  REWARD_REDEMPTION = 'reward_redemption',
  ADMIN_ADJUSTMENT = 'admin_adjustment',
}

export interface Transaction {
  id: string
  userId: string
  type: TransactionType
  status: TransactionStatus
  reason: TransactionReason
  /** Exact amount in asset base units (stroops for XLM). Primary monetary field. */
  amountStroops: bigint | string
  /** Human-readable decimal string (e.g. "5.0000000"). Display only. */
  amountFormatted?: string
  asset?: AssetIdentity
  referenceId?: string
  referenceType?: string
  note?: string
  createdAt: string
  completedAt?: string
}

export interface Balance {
  userId: string
  /** Exact available amount in asset base units. Primary monetary field. */
  availableStroops: bigint | string
  availableFormatted?: string
  /** Exact pending amount in asset base units. Primary monetary field. */
  pendingStroops: bigint | string
  pendingFormatted?: string
  /** Exact lifetime earned in asset base units. Primary monetary field. */
  lifetimeStroops: bigint | string
  lifetimeFormatted?: string
  asset?: AssetIdentity
  updatedAt: string
}

export interface RewardSummary {
  balance: Balance
  recentTransactions: Transaction[]
  /** Exact amount earned this month in asset base units. */
  earnedThisMonthStroops: bigint | string
  earnedThisMonthFormatted?: string
  /** Exact amount spent this month in asset base units. */
  spentThisMonthStroops: bigint | string
  spentThisMonthFormatted?: string
}

// Request types
export interface CreateTransactionRequest {
  userId: string
  type: TransactionType
  reason: TransactionReason
  amount: number | bigint | string
  asset?: AssetIdentity
  referenceId?: string
  referenceType?: string
  note?: string
}

export interface TransactionFilterParams {
  type?: TransactionType
  status?: TransactionStatus
  reason?: TransactionReason
  fromDate?: string
  toDate?: string
  minAmount?: number | bigint | string
  maxAmount?: number | bigint | string
}
