// ════════════════════════════════════════════════════════════
// 포인트 지갑 공용 헬퍼 (point_wallets 단일 원장)
//
// 모든 포인트 적립/차감은 이 헬퍼를 거쳐 point_wallets + point_transactions
// 에 일관되게 기록한다. (파트너 리워드 / 행사 / 이전 등 일원화)
// ════════════════════════════════════════════════════════════

export type OwnerType = 'user' | 'group'
export type PointType = 'subscription' | 'charged' | 'reward' | 'transfer'

export async function getOrCreateWallet(
  db: D1Database,
  ownerType: OwnerType,
  ownerId: number
): Promise<{ id: number; balance: number }> {
  const existing = await db.prepare(
    `SELECT id, balance FROM point_wallets WHERE owner_type = ? AND owner_id = ?`
  ).bind(ownerType, ownerId).first<{ id: number; balance: number }>()

  if (existing) return existing

  const result = await db.prepare(
    `INSERT INTO point_wallets (owner_type, owner_id, balance) VALUES (?, ?, 0)`
  ).bind(ownerType, ownerId).run()

  return { id: result.meta.last_row_id as number, balance: 0 }
}

export interface CreditOpts {
  type: string                 // point_transactions.type (예: charge_partner)
  pointType?: PointType        // 기본 'reward'
  refType?: string | null
  refId?: number | null
  description?: string | null
  expiresAt?: string | null    // null = 무기한
}

// 지갑 적립 (+) — point_wallets 잔액 증가 + point_transactions 기록
export async function creditWallet(
  db: D1Database,
  ownerType: OwnerType,
  ownerId: number,
  amount: number,
  opts: CreditOpts
): Promise<{ walletId: number; balanceAfter: number }> {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('creditWallet: amount는 양의 정수여야 합니다.')
  }

  const wallet = await getOrCreateWallet(db, ownerType, ownerId)
  const balanceAfter = wallet.balance + amount
  const now = new Date().toISOString()

  await db.batch([
    db.prepare(
      `UPDATE point_wallets SET balance = ?, total_charged = total_charged + ?, updated_at = ? WHERE id = ?`
    ).bind(balanceAfter, amount, now, wallet.id),
    db.prepare(`
      INSERT INTO point_transactions
        (wallet_id, type, point_type, amount, balance_after, ref_type, ref_id, description, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      wallet.id, opts.type, opts.pointType ?? 'reward',
      amount, balanceAfter,
      opts.refType ?? null, opts.refId ?? null,
      opts.description ?? null, opts.expiresAt ?? null, now
    ),
  ])

  return { walletId: wallet.id, balanceAfter }
}

export interface DebitOpts {
  type: string                 // point_transactions.type (예: use_event_create)
  pointType?: PointType        // 기본 'reward'
  refType?: string | null
  refId?: number | null
  description?: string | null
}

// 지갑 차감 (−) — 잔액 부족 시 { ok:false, balance } 반환(예외 아님)
export async function debitWallet(
  db: D1Database,
  ownerType: OwnerType,
  ownerId: number,
  amount: number,
  opts: DebitOpts
): Promise<{ ok: true; walletId: number; balanceAfter: number } | { ok: false; balance: number }> {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('debitWallet: amount는 양의 정수여야 합니다.')
  }

  const wallet = await getOrCreateWallet(db, ownerType, ownerId)
  if (wallet.balance < amount) {
    return { ok: false, balance: wallet.balance }
  }

  const balanceAfter = wallet.balance - amount
  const now = new Date().toISOString()

  await db.batch([
    db.prepare(
      `UPDATE point_wallets SET balance = ?, total_used = total_used + ?, updated_at = ? WHERE id = ?`
    ).bind(balanceAfter, amount, now, wallet.id),
    db.prepare(`
      INSERT INTO point_transactions
        (wallet_id, type, point_type, amount, balance_after, ref_type, ref_id, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      wallet.id, opts.type, opts.pointType ?? 'reward',
      -amount, balanceAfter,
      opts.refType ?? null, opts.refId ?? null,
      opts.description ?? null, now
    ),
  ])

  return { ok: true, walletId: wallet.id, balanceAfter }
}
