-- ============================================================
-- METI DB Migration 0004: Events (행사)
-- ============================================================

-- 행사 테이블
CREATE TABLE IF NOT EXISTS events (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id         INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  organizer_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT,
  thumbnail_url    TEXT,
  location         TEXT,
  starts_at        DATETIME NOT NULL,
  ends_at          DATETIME,
  visibility       TEXT NOT NULL DEFAULT 'public',   -- public | group_only
  registration_type TEXT NOT NULL DEFAULT 'free',    -- free | pre_required
  entry_method     TEXT NOT NULL DEFAULT 'qr',       -- nfc_qr | qr | manual
  max_participants INTEGER,
  status           TEXT NOT NULL DEFAULT 'upcoming', -- upcoming | ongoing | ended | cancelled
  is_deleted       INTEGER NOT NULL DEFAULT 0,
  deleted_at       DATETIME,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 행사 참가 신청
CREATE TABLE IF NOT EXISTS event_participants (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id     INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'registered',  -- registered | checked_in | cancelled
  checked_in_at DATETIME,
  entry_method  TEXT,  -- nfc | qr | manual
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, user_id)
);

-- 행사 입장 로그
CREATE TABLE IF NOT EXISTS event_entry_logs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id     INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_method TEXT NOT NULL,  -- nfc | qr | manual
  processed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- 수동 처리 시 관리자 ID
  entered_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_events_group_id ON events(group_id);
CREATE INDEX IF NOT EXISTS idx_events_organizer_id ON events(organizer_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_starts_at ON events(starts_at);
CREATE INDEX IF NOT EXISTS idx_event_participants_event_id ON event_participants(event_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_user_id ON event_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_status ON event_participants(status);
CREATE INDEX IF NOT EXISTS idx_event_entry_logs_event_id ON event_entry_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_event_entry_logs_user_id ON event_entry_logs(user_id);
