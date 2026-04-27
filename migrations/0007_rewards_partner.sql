-- ============================================================
-- METI DB Migration 0007: Rewards & Partner Services
-- ============================================================

-- 리워드 테이블
CREATE TABLE IF NOT EXISTS rewards (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,        -- signup | card_exchange | event_attend | referral | partner
  source        TEXT NOT NULL DEFAULT 'system',  -- system | partner
  partner_id    INTEGER REFERENCES partner_services(id) ON DELETE SET NULL,
  points        INTEGER NOT NULL DEFAULT 0,
  description   TEXT,
  expires_at    DATETIME,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 리워드 포인트 잔액
CREATE TABLE IF NOT EXISTS reward_balances (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  points      INTEGER NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 파트너 서비스 (HappyTree 등)
CREATE TABLE IF NOT EXISTS partner_services (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  description  TEXT,
  api_key      TEXT UNIQUE NOT NULL,    -- 서버간 통신용 API Key
  webhook_url  TEXT,                    -- 파트너→METI 웹훅 URL
  status       TEXT NOT NULL DEFAULT 'active',  -- active | inactive | suspended
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 파트너 유저 매핑
CREATE TABLE IF NOT EXISTS partner_user_mapping (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  partner_id          INTEGER NOT NULL REFERENCES partner_services(id) ON DELETE CASCADE,
  user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  external_user_key   TEXT NOT NULL,  -- hash(meti_user_id) — DB 공유 없이 식별
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(partner_id, user_id),
  UNIQUE(partner_id, external_user_key)
);

-- 파트너 리워드 이벤트 로그
CREATE TABLE IF NOT EXISTS partner_reward_events (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  partner_id        INTEGER NOT NULL REFERENCES partner_services(id) ON DELETE CASCADE,
  external_user_key TEXT NOT NULL,
  user_id           INTEGER REFERENCES users(id) ON DELETE SET NULL,
  event_type        TEXT NOT NULL,  -- purchase | visit | signup | etc (파트너 정의)
  points_awarded    INTEGER NOT NULL DEFAULT 0,
  payload           TEXT,           -- JSON: 파트너가 전달한 원본 데이터
  processed         INTEGER NOT NULL DEFAULT 0,
  processed_at      DATETIME,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 알림 (Notification)
CREATE TABLE IF NOT EXISTS notifications (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,  -- card_received | group_joined | event_reminder | reward | system | headhunter_view
  title        TEXT NOT NULL,
  body         TEXT,
  data         TEXT,            -- JSON: 딥링크 등 부가 데이터
  is_read      INTEGER NOT NULL DEFAULT 0,
  read_at      DATETIME,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_rewards_user_id ON rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_rewards_type ON rewards(type);
CREATE INDEX IF NOT EXISTS idx_reward_balances_user_id ON reward_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_partner_user_mapping_partner_id ON partner_user_mapping(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_user_mapping_user_id ON partner_user_mapping(user_id);
CREATE INDEX IF NOT EXISTS idx_partner_user_mapping_external_key ON partner_user_mapping(external_user_key);
CREATE INDEX IF NOT EXISTS idx_partner_reward_events_partner_id ON partner_reward_events(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_reward_events_processed ON partner_reward_events(processed);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
