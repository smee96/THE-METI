-- 0027: FCM 디바이스 토큰 + 웹 자동로그인 원타임 토큰
-- 근거: ELID_App_Reply_Chat_Push_2026-07-16.md §C-2(원타임 토큰), §D-1(디바이스 토큰 API)

-- FCM 디바이스 토큰 (유저당 여러 기기)
CREATE TABLE IF NOT EXISTS device_tokens (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  platform    TEXT NOT NULL,   -- android | ios
  app_version TEXT,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_tokens(user_id);

-- 웹 세션 원타임 토큰 (앱 → 외부 브라우저 자동 로그인, 1회용·짧은 만료)
CREATE TABLE IF NOT EXISTS web_session_tokens (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used_at    DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_web_session_tokens_token ON web_session_tokens(token);
