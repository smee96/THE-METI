-- ============================================================
-- METI DB Migration 0002: Cards (명함)
-- ============================================================

-- 명함 테이블
CREATE TABLE IF NOT EXISTS cards (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id     INTEGER REFERENCES groups(id) ON DELETE SET NULL,  -- NULL이면 개인 명함
  card_type    TEXT NOT NULL DEFAULT 'personal',   -- personal | group
  name         TEXT NOT NULL,
  title        TEXT,                               -- 직책
  company      TEXT,                               -- 소속
  email        TEXT,
  phone        TEXT,
  website      TEXT,
  bio          TEXT,
  avatar_url   TEXT,
  template_id  TEXT DEFAULT 'default',             -- 디자인 템플릿
  is_primary   INTEGER NOT NULL DEFAULT 0,         -- 대표 명함 여부
  is_public    INTEGER NOT NULL DEFAULT 1,         -- 웹 공개 여부 (앱 미설치자용)
  is_active    INTEGER NOT NULL DEFAULT 1,
  is_deleted   INTEGER NOT NULL DEFAULT 0,
  deleted_at   DATETIME,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 명함 SNS 링크
CREATE TABLE IF NOT EXISTS card_sns_links (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id    INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  platform   TEXT NOT NULL,   -- linkedin | instagram | twitter | github | facebook | etc
  url        TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 명함 커스텀 필드 (리크루팅용 태그 등)
CREATE TABLE IF NOT EXISTS card_tags (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id    INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  tag_type   TEXT NOT NULL,   -- skill | career | job_type | location | etc
  tag_value  TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 명함첩 (수신한 명함 저장)
CREATE TABLE IF NOT EXISTS card_contacts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- 명함첩 소유자
  card_id     INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,  -- 저장된 명함
  memo        TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(owner_id, card_id)
);

-- 명함첩 태그 (수신자가 붙이는 분류 태그)
CREATE TABLE IF NOT EXISTS card_contact_tags (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id  INTEGER NOT NULL REFERENCES card_contacts(id) ON DELETE CASCADE,
  tag         TEXT NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- QR 토큰 (행사 입장 등 단기 유효 토큰)
CREATE TABLE IF NOT EXISTS qr_tokens (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id    INTEGER REFERENCES cards(id) ON DELETE CASCADE,
  token      TEXT UNIQUE NOT NULL,
  purpose    TEXT NOT NULL DEFAULT 'card_share',  -- card_share | event_entry
  event_id   INTEGER,
  expires_at DATETIME NOT NULL,
  used_at    DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- NFC 실물카드
CREATE TABLE IF NOT EXISTS nfc_physical_cards (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  group_id     INTEGER REFERENCES groups(id) ON DELETE SET NULL,
  card_id      INTEGER REFERENCES cards(id) ON DELETE SET NULL,
  nfc_uid      TEXT UNIQUE,                        -- NFC 태그 UID
  serial_no    TEXT UNIQUE,                        -- 카드 일련번호
  order_type   TEXT NOT NULL DEFAULT 'individual', -- individual | group
  status       TEXT NOT NULL DEFAULT 'pending',    -- pending | approved | issued | lost | deactivated
  applied_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  issued_at    DATETIME,
  deactivated_at DATETIME,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_cards_user_id ON cards(user_id);
CREATE INDEX IF NOT EXISTS idx_cards_group_id ON cards(group_id);
CREATE INDEX IF NOT EXISTS idx_cards_card_type ON cards(card_type);
CREATE INDEX IF NOT EXISTS idx_card_sns_links_card_id ON card_sns_links(card_id);
CREATE INDEX IF NOT EXISTS idx_card_tags_card_id ON card_tags(card_id);
CREATE INDEX IF NOT EXISTS idx_card_tags_type_value ON card_tags(tag_type, tag_value);
CREATE INDEX IF NOT EXISTS idx_card_contacts_owner_id ON card_contacts(owner_id);
CREATE INDEX IF NOT EXISTS idx_card_contacts_card_id ON card_contacts(card_id);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_token ON qr_tokens(token);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_user_id ON qr_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_nfc_physical_cards_user_id ON nfc_physical_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_nfc_physical_cards_nfc_uid ON nfc_physical_cards(nfc_uid);
