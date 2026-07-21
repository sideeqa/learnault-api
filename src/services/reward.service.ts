import { StellarService } from './stellar.service'
import { NotificationService } from './notification.service'
import {
  AssetIdentity,
  NATIVE_XLM_ASSET,
  calculatePercentageStroops,
  safeAddStroops,
  safeSubtractStroops,
  stroopsToDecimalString,
  toStroops,
} from '../utils/money'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ModuleDifficulty =
  'beginner' | 'intermediate' | 'advanced' | 'expert'

export interface Module {
  id: string
  difficulty: ModuleDifficulty
  baseReward?: number
  baseRewardStroops?: bigint
  rewardAmount?: bigint
  title: string
  assetCode?: string
  assetIssuer?: string | null
  assetDecimals?: number
  network?: string
}

export interface RewardClaim {
  userId: string
  moduleId: string
  walletAddress: string
  streakDays?: number
  referralCode?: string
}

export interface RewardResult {
  transactionId: string
  userId: string
  moduleId: string
  baseAmount: number
  baseAmountStroops: bigint
  streakBonus: number
  streakBonusStroops: bigint
  referralBonus: number
  referralBonusStroops: bigint
  totalAmount: number
  totalAmountStroops: bigint
  asset: AssetIdentity
  stellarTxHash: string
  claimedAt: Date
}

export interface Transaction {
  id: string
  userId: string
  moduleId?: string
  amount: number
  amountStroops: bigint
  assetCode?: string
  assetIssuer?: string | null
  assetDecimals?: number
  network?: string
  type: 'module_reward' | 'streak_bonus' | 'referral_reward' | 'withdrawal'
  status: 'pending' | 'completed' | 'failed'
  stellarTxHash?: string
  createdAt: Date
  completedAt?: Date
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const DIFFICULTY_MULTIPLIERS: Record<ModuleDifficulty, number> = {
  beginner: 1.0,
  intermediate: 1.5,
  advanced: 2.0,
  expert: 3.0,
}

export const BASE_REWARD_XLM = 5
export const BASE_REWARD_STROOPS = 50_000_000n
export const STREAK_BONUS_RATE = 0.1 // 10% bonus per streak day
export const MAX_STREAK_BONUS = 1.0 // cap at 100% of base
export const REFERRAL_BONUS_XLM = 2
export const REFERRAL_BONUS_STROOPS = 20_000_000n

export interface WithdrawalRequest {
  userId: string
  walletAddress: string
  amount: number | bigint | string
  memo?: string
}

export interface WithdrawalResult {
  transactionId: string
  userId: string
  amount: number
  amountStroops: bigint
  asset: AssetIdentity
  stellarTxHash: string
  status: 'pending' | 'completed' | 'failed'
  requestedAt: Date
  completedAt?: Date
}

export interface Balance {
  userId: string
  available: number
  availableStroops: bigint
  pending: number
  pendingStroops: bigint
  lifetime: number
  lifetimeStroops: bigint
  asset: AssetIdentity
  updatedAt: Date
}

export interface TransactionFilter {
  type?: Transaction['type']
  status?: Transaction['status']
  fromDate?: Date
  toDate?: Date
  limit?: number
  offset?: number
}

// ─── In-memory stores (replace with Prisma in production) ────────────────────

const claimedRewards = new Map<string, Set<string>>()
const transactions: Transaction[] = []
const referralCodes = new Map<string, string>() // code -> referrerId
const pendingWithdrawals = new Map<string, WithdrawalRequest>()

// ─── RewardService ────────────────────────────────────────────────────────────

export class RewardService {
  private stellarService: StellarService
  private notificationService: NotificationService

  constructor(stellarService?: StellarService) {
    this.stellarService = stellarService ?? new StellarService()
    this.notificationService = new NotificationService()
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Calculate the reward breakdown for a module completion without paying out.
   */
  calculateReward(
    module: Module,
    streakDays = 0,
    hasReferral = false,
  ): {
    baseAmount: number
    baseAmountStroops: bigint
    streakBonus: number
    streakBonusStroops: bigint
    referralBonus: number
    referralBonusStroops: bigint
    totalAmount: number
    totalAmountStroops: bigint
  } {
    const baseAmountStroops = this.calculateBaseRewardStroops(module)
    const streakBonusStroops = this.calculateStreakBonusStroops(
      baseAmountStroops,
      streakDays,
    )
    const referralBonusStroops = hasReferral ? REFERRAL_BONUS_STROOPS : 0n
    const totalAmountStroops = safeAddStroops(
      baseAmountStroops,
      streakBonusStroops,
      referralBonusStroops,
    )

    const baseAmount = Number(stroopsToDecimalString(baseAmountStroops))
    const streakBonus = Number(stroopsToDecimalString(streakBonusStroops))
    const referralBonus = Number(stroopsToDecimalString(referralBonusStroops))
    const totalAmount = Number(stroopsToDecimalString(totalAmountStroops))

    return {
      baseAmount,
      baseAmountStroops,
      streakBonus,
      streakBonusStroops,
      referralBonus,
      referralBonusStroops,
      totalAmount,
      totalAmountStroops,
    }
  }

  /**
   * Claim a reward for completing a module. Validates, calculates, pays out via
   * Stellar and records the transaction.
   */
  async claimReward(claim: RewardClaim, module: Module): Promise<RewardResult> {
    // 1. Validate: prevent double-claiming
    this.assertNotAlreadyClaimed(claim.userId, claim.moduleId)

    // 2. Resolve referral code to referrer id
    const referrerId = claim.referralCode
      ? this.resolveReferralCode(claim.referralCode)
      : undefined

    // 3. Calculate amounts
    const rewardBreakdown = this.calculateReward(
      module,
      claim.streakDays ?? 0,
      !!referrerId,
    )

    const asset: AssetIdentity = {
      code: module.assetCode || NATIVE_XLM_ASSET.code,
      issuer: module.assetIssuer || NATIVE_XLM_ASSET.issuer,
      decimals: module.assetDecimals || NATIVE_XLM_ASSET.decimals,
      network: module.network || NATIVE_XLM_ASSET.network,
    }

    // 4. Payout via Stellar
    const decimalStr = stroopsToDecimalString(
      rewardBreakdown.totalAmountStroops,
      asset.decimals,
    )
    const paymentResult = await this.stellarService.sendPayment({
      sourceSecret: process.env.STELLAR_SOURCE_SECRET!,
      destinationPublicKey: claim.walletAddress,
      amount: decimalStr,
      memo: `Learnault reward: module ${claim.moduleId}`,
    })
    const stellarTxHash = paymentResult.hash

    // 5. Mark claimed to prevent duplicates
    this.markAsClaimed(claim.userId, claim.moduleId)

    // 6. Record transaction
    const transactionId = this.recordTransaction({
      userId: claim.userId,
      moduleId: claim.moduleId,
      amount: rewardBreakdown.totalAmount,
      amountStroops: rewardBreakdown.totalAmountStroops,
      assetCode: asset.code,
      assetIssuer: asset.issuer,
      assetDecimals: asset.decimals,
      network: asset.network,
      type: 'module_reward',
      status: 'completed',
      stellarTxHash,
    })

    // 7. Pay referral bonus if applicable (non-blocking)
    if (referrerId && rewardBreakdown.referralBonusStroops > 0n) {
      await this.payReferralBonus(referrerId, claim.moduleId, stellarTxHash)
    }

    // 8. Send push notification for reward receipt (non-blocking)
    this.notificationService
      .queueNotification(
        claim.userId,
        'rewardReceipt',
        'Reward Received!',
        `You earned ${decimalStr} XLM for completing module ${module.title}.`,
      )
      .catch((err) =>
        console.error('[Notifications] Reward notification error:', err),
      )

    return {
      transactionId,
      userId: claim.userId,
      moduleId: claim.moduleId,
      baseAmount: rewardBreakdown.baseAmount,
      baseAmountStroops: rewardBreakdown.baseAmountStroops,
      streakBonus: rewardBreakdown.streakBonus,
      streakBonusStroops: rewardBreakdown.streakBonusStroops,
      referralBonus: rewardBreakdown.referralBonus,
      referralBonusStroops: rewardBreakdown.referralBonusStroops,
      totalAmount: rewardBreakdown.totalAmount,
      totalAmountStroops: rewardBreakdown.totalAmountStroops,
      asset,
      stellarTxHash,
      claimedAt: new Date(),
    }
  }

  /**
   * Register a referral code mapped to a user.
   */
  registerReferralCode(code: string, userId: string): void {
    if (referralCodes.has(code)) {
      throw new Error(`Referral code "${code}" is already in use`)
    }
    referralCodes.set(code, userId)
  }

  /**
   * Check whether a user has already claimed the reward for a module.
   */
  hasAlreadyClaimed(userId: string, moduleId: string): boolean {
    return claimedRewards.get(userId)?.has(moduleId) ?? false
  }

  /**
   * Return all recorded transactions.
   */
  getTransactions(): Transaction[] {
    return [...transactions]
  }

  /**
   * Return all recorded transactions for a specific user.
   */
  getUserTransactions(userId: string): Transaction[] {
    return transactions.filter((t) => t.userId === userId)
  }

  /**
   * Calculate user's current balance based on completed rewards and withdrawals.
   */
  getBalance(userId: string): Balance {
    const userTransactions = this.getUserTransactions(userId)

    const earnedStroops = userTransactions
      .filter(
        (t) =>
          t.status === 'completed' &&
          ['module_reward', 'streak_bonus', 'referral_reward'].includes(t.type),
      )
      .reduce((sum, t) => sum + t.amountStroops, 0n)

    const withdrawnStroops = userTransactions
      .filter((t) => t.status === 'completed' && t.type === 'withdrawal')
      .reduce((sum, t) => sum + t.amountStroops, 0n)

    const pendingStroops = userTransactions
      .filter((t) => t.status === 'pending' && t.type === 'withdrawal')
      .reduce((sum, t) => sum + t.amountStroops, 0n)

    const availableStroops = safeSubtractStroops(
      safeSubtractStroops(earnedStroops, withdrawnStroops),
      pendingStroops,
    )
    const effectiveAvailable = availableStroops < 0n ? 0n : availableStroops

    return {
      userId,
      available: Number(stroopsToDecimalString(effectiveAvailable)),
      availableStroops: effectiveAvailable,
      pending: Number(stroopsToDecimalString(pendingStroops)),
      pendingStroops,
      lifetime: Number(stroopsToDecimalString(earnedStroops)),
      lifetimeStroops: earnedStroops,
      asset: NATIVE_XLM_ASSET,
      updatedAt: new Date(),
    }
  }

  /**
   * Get transaction history with filtering and pagination.
   */
  getTransactionHistory(
    userId: string,
    filters: TransactionFilter = {},
  ): {
    transactions: Transaction[]
    total: number
    hasMore: boolean
  } {
    let userTransactions = this.getUserTransactions(userId)

    // Apply filters
    if (filters.type) {
      userTransactions = userTransactions.filter((t) => t.type === filters.type)
    }

    if (filters.status) {
      userTransactions = userTransactions.filter(
        (t) => t.status === filters.status,
      )
    }

    if (filters.fromDate) {
      userTransactions = userTransactions.filter(
        (t) => t.createdAt >= filters.fromDate!,
      )
    }

    if (filters.toDate) {
      userTransactions = userTransactions.filter(
        (t) => t.createdAt <= filters.toDate!,
      )
    }

    // Sort by creation date (newest first)
    userTransactions.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    )

    const total = userTransactions.length
    const limit = filters.limit ?? 20
    const offset = filters.offset ?? 0

    const paginatedTransactions = userTransactions.slice(offset, offset + limit)

    return {
      transactions: paginatedTransactions,
      total,
      hasMore: offset + limit < total,
    }
  }

  /**
   * Process a withdrawal request.
   */
  async processWithdrawal(
    request: WithdrawalRequest,
  ): Promise<WithdrawalResult> {
    const amountStroops = toStroops(request.amount)
    if (amountStroops <= 0n) {
      throw new Error('Withdrawal amount must be greater than 0')
    }

    const balance = this.getBalance(request.userId)

    if (amountStroops > balance.availableStroops) {
      const requestedDecimal = stroopsToDecimalString(amountStroops)
      throw new Error(
        `Insufficient balance. Available: ${balance.available} XLM, Requested: ${requestedDecimal} XLM`,
      )
    }

    // Create pending withdrawal transaction
    const transactionId = this.recordTransaction({
      userId: request.userId,
      amount: Number(stroopsToDecimalString(amountStroops)),
      amountStroops,
      assetCode: NATIVE_XLM_ASSET.code,
      assetIssuer: NATIVE_XLM_ASSET.issuer,
      assetDecimals: NATIVE_XLM_ASSET.decimals,
      network: NATIVE_XLM_ASSET.network,
      type: 'withdrawal',
      status: 'pending',
      stellarTxHash: undefined,
    })

    // Store pending withdrawal
    pendingWithdrawals.set(transactionId, request)

    // Process the withdrawal via Stellar
    try {
      const paymentResult = await this.stellarService.sendPayment({
        sourceSecret: process.env.STELLAR_SOURCE_SECRET!,
        destinationPublicKey: request.walletAddress,
        amount: stroopsToDecimalString(amountStroops),
        memo: request.memo ?? `Learnault withdrawal: ${transactionId}`,
      })
      const stellarTxHash = paymentResult.hash

      // Update transaction status to completed
      this.updateTransactionStatus(transactionId, 'completed', stellarTxHash)

      return {
        transactionId,
        userId: request.userId,
        amount: Number(stroopsToDecimalString(amountStroops)),
        amountStroops,
        asset: NATIVE_XLM_ASSET,
        stellarTxHash,
        status: 'completed',
        requestedAt: new Date(),
        completedAt: new Date(),
      }
    } catch (error) {
      // Mark transaction as failed
      this.updateTransactionStatus(transactionId, 'failed')
      pendingWithdrawals.delete(transactionId)
      throw error
    }
  }

  /**
   * Check if user has sufficient balance for withdrawal.
   */
  hasSufficientBalance(
    userId: string,
    amount: number | bigint | string,
  ): boolean {
    const amountStroops = toStroops(amount)
    const balance = this.getBalance(userId)

    return amountStroops <= balance.availableStroops
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private calculateBaseRewardStroops(module: Module): bigint {
    if (module.rewardAmount !== undefined && module.rewardAmount !== null) {
      return module.rewardAmount
    }
    if (
      module.baseRewardStroops !== undefined &&
      module.baseRewardStroops !== null
    ) {
      return module.baseRewardStroops
    }
    if (module.baseReward !== undefined && module.baseReward !== null) {
      const multiplier = DIFFICULTY_MULTIPLIERS[module.difficulty] ?? 1.0
      // 5 XLM base * multiplier
      return toStroops((module.baseReward * multiplier).toFixed(7))
    }

    const multiplier = DIFFICULTY_MULTIPLIERS[module.difficulty] ?? 1.0
    return toStroops((BASE_REWARD_XLM * multiplier).toFixed(7))
  }

  private calculateStreakBonusStroops(
    baseStroops: bigint,
    streakDays: number,
  ): bigint {
    if (streakDays <= 0) return 0n
    const streakPercent = BigInt(Math.min(streakDays * 10, 100))
    return calculatePercentageStroops(baseStroops, streakPercent)
  }

  private resolveReferralCode(code: string): string | undefined {
    return referralCodes.get(code)
  }

  private assertNotAlreadyClaimed(userId: string, moduleId: string): void {
    if (this.hasAlreadyClaimed(userId, moduleId)) {
      throw new Error(
        `User "${userId}" has already claimed the reward for module "${moduleId}"`,
      )
    }
  }

  private markAsClaimed(userId: string, moduleId: string): void {
    if (!claimedRewards.has(userId)) {
      claimedRewards.set(userId, new Set())
    }
    claimedRewards.get(userId)!.add(moduleId)
  }

  private recordTransaction(
    data: Omit<Transaction, 'id' | 'createdAt'>,
  ): string {
    const id = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    transactions.push({ id, ...data, createdAt: new Date() })

    return id
  }

  private updateTransactionStatus(
    transactionId: string,
    status: Transaction['status'],
    stellarTxHash?: string,
  ): void {
    const transaction = transactions.find((t) => t.id === transactionId)
    if (transaction) {
      transaction.status = status
      if (stellarTxHash) {
        transaction.stellarTxHash = stellarTxHash
      }
      if (status === 'completed') {
        transaction.completedAt = new Date()
      }
    }
  }

  private async payReferralBonus(
    referrerId: string,
    _moduleId: string,
    _originalTxHash: string,
  ): Promise<void> {
    try {
      console.warn(
        `Referral bonus skipped: No wallet address storage implemented for user ${referrerId}`,
      )
      return
    } catch (err) {
      console.error(`Failed to pay referral bonus to user ${referrerId}:`, err)
    }
  }

  /** @internal – resets in-memory state between unit tests */
  _resetState(): void {
    claimedRewards.clear()
    transactions.length = 0
    referralCodes.clear()
    pendingWithdrawals.clear()
  }
}
