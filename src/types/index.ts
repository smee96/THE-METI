// ============================================================
// ELID Type Definitions
// ============================================================

export type Bindings = {
  DB: D1Database
  STORAGE: R2Bucket
  JWT_SECRET: string
  APP_ENV: string
  APP_NAME: string
  JWT_EXPIRES_IN: string
  REFRESH_TOKEN_EXPIRES_IN: string
  PARTNER_WEBHOOK_SECRET: string
  TOSS_CLIENT_KEY?: string   // 미설정 환경에서는 충전 결제 비활성
  TOSS_SECRET_KEY?: string
}

export type Variables = {
  userId: number
  userEmail: string
  userPlan: string
  accountType: string
}

// ── User ──────────────────────────────────────────────
export type User = {
  id: number
  email: string
  password_hash: string
  name: string
  account_type: 'personal' | 'headhunter' | 'group_admin'
  plan: 'free' | 'pro' | 'business'
  plan_expires_at: string | null
  avatar_url: string | null
  is_verified: number
  is_active: number
  is_deleted: number
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export type UserPublic = Omit<User, 'password_hash' | 'is_deleted' | 'deleted_at'>

// ── Card ──────────────────────────────────────────────
export type Card = {
  id: number
  user_id: number
  group_id: number | null
  card_type: 'personal' | 'group'
  name: string
  title: string | null
  company: string | null
  email: string | null
  phone: string | null
  website: string | null
  bio: string | null
  avatar_url: string | null
  template_id: string
  is_primary: number
  is_public: number
  is_active: number
  is_deleted: number
  created_at: string
  updated_at: string
}

export type CardSnsLink = {
  id: number
  card_id: number
  platform: string
  url: string
  sort_order: number
  created_at: string
}

export type CardWithDetails = Card & {
  sns_links: CardSnsLink[]
  tags: CardTag[]
}

export type CardTag = {
  id: number
  card_id: number
  tag_type: string
  tag_value: string
  created_at: string
}

// ── Group ─────────────────────────────────────────────
export type Group = {
  id: number
  name: string
  description: string | null
  logo_url: string | null
  category: 'association' | 'company' | 'club' | 'other'
  visibility: 'public' | 'private'
  status: 'pending' | 'active' | 'suspended'
  plan: string
  max_members: number | null
  custom_join_fields: string | null
  admin_user_id: number | null
  approved_by: number | null
  approved_at: string | null
  is_featured: number
  is_deleted: number
  created_at: string
  updated_at: string
}

export type GroupMember = {
  id: number
  group_id: number
  user_id: number
  role: 'admin' | 'sub_admin' | 'executive' | 'member'
  custom_role: string | null
  status: 'pending' | 'active' | 'rejected' | 'left' | 'kicked'
  join_fields: string | null
  invited_by: number | null
  approved_by: number | null
  approved_at: string | null
  joined_at: string | null
  left_at: string | null
  created_at: string
  updated_at: string
}

// ── Event ─────────────────────────────────────────────
export type Event = {
  id: number
  group_id: number
  organizer_id: number
  title: string
  description: string | null
  thumbnail_url: string | null
  location: string | null
  starts_at: string
  ends_at: string | null
  visibility: 'public' | 'group_only'
  registration_type: 'free' | 'pre_required'
  entry_method: 'nfc_qr' | 'qr' | 'manual'
  max_participants: number | null
  status: 'upcoming' | 'ongoing' | 'ended' | 'cancelled'
  is_deleted: number
  created_at: string
  updated_at: string
}

// ── Chat ──────────────────────────────────────────────
export type ChatRoom = {
  id: number
  room_type: 'direct' | 'group'
  group_id: number | null
  name: string | null
  is_active: number
  created_at: string
  updated_at: string
}

export type ChatMessage = {
  id: number
  room_id: number
  sender_id: number
  message_type: 'text' | 'image' | 'file' | 'card' | 'system'
  content: string | null
  file_url: string | null
  card_id: number | null
  is_pinned: number
  is_deleted: number
  deleted_at: string | null
  expires_at: string | null
  created_at: string
}

// ── Pagination ────────────────────────────────────────
export type PaginationParams = {
  page: number
  limit: number
}

export type PaginatedResponse<T> = {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    total_pages: number
    has_next: boolean
  }
}

// ── API Response ──────────────────────────────────────
export type ApiResponse<T = unknown> = {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// ── Auth ──────────────────────────────────────────────
export type JWTPayload = {
  sub: string         // user id
  email: string
  plan: string
  account_type: string
  iat?: number
  exp?: number
}
