-- ============================================================
-- METI DB Migration 0005: Chat (채팅)
-- 무료 채팅: 데일리 삭제 정책 적용
-- ============================================================

-- 채팅방
CREATE TABLE IF NOT EXISTS chat_rooms (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  room_type    TEXT NOT NULL DEFAULT 'direct',  -- direct | group
  group_id     INTEGER REFERENCES groups(id) ON DELETE CASCADE,  -- 그룹 채팅일 경우
  name         TEXT,                             -- 그룹 채팅방 이름
  is_active    INTEGER NOT NULL DEFAULT 1,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 채팅방 참여자
CREATE TABLE IF NOT EXISTS chat_room_members (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id       INTEGER NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'member',  -- admin | member
  last_read_at  DATETIME,
  is_blocked    INTEGER NOT NULL DEFAULT 0,
  left_at       DATETIME,
  joined_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(room_id, user_id)
);

-- 채팅 메시지
CREATE TABLE IF NOT EXISTS chat_messages (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id      INTEGER NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL DEFAULT 'text',    -- text | image | file | card | system
  content      TEXT,                             -- 텍스트 내용
  file_url     TEXT,                             -- 이미지/파일 URL
  card_id      INTEGER REFERENCES cards(id) ON DELETE SET NULL,  -- 명함 공유
  is_pinned    INTEGER NOT NULL DEFAULT 0,
  is_deleted   INTEGER NOT NULL DEFAULT 0,
  deleted_at   DATETIME,
  expires_at   DATETIME,                         -- 무료: 다음날 자정 삭제
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 메시지 읽음 처리
CREATE TABLE IF NOT EXISTS chat_message_reads (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id  INTEGER NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(message_id, user_id)
);

-- 차단 목록
CREATE TABLE IF NOT EXISTS user_blocks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  blocker_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(blocker_id, blocked_id)
);

-- 신고
CREATE TABLE IF NOT EXISTS reports (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type  TEXT NOT NULL,  -- user | message | card | group
  target_id    INTEGER NOT NULL,
  reason       TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'pending',  -- pending | reviewed | resolved | dismissed
  reviewed_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at  DATETIME,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_chat_rooms_group_id ON chat_rooms(group_id);
CREATE INDEX IF NOT EXISTS idx_chat_room_members_room_id ON chat_room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_room_members_user_id ON chat_room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_expires_at ON chat_messages(expires_at);
CREATE INDEX IF NOT EXISTS idx_chat_message_reads_message_id ON chat_message_reads(message_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker_id ON user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
