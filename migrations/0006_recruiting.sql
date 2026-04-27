-- ============================================================
-- METI DB Migration 0006: Recruiting (리크루팅)
-- ============================================================

-- 구직 프로필 (구직 의사 표시)
CREATE TABLE IF NOT EXISTS job_seekers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  visibility      TEXT NOT NULL DEFAULT 'public',  -- public | private
  desired_jobs    TEXT,    -- JSON: 희망 직무 배열
  career_years    INTEGER, -- 경력 연차
  skills          TEXT,    -- JSON: 스킬 태그 배열
  locations       TEXT,    -- JSON: 희망 지역 배열
  portfolio_url   TEXT,
  resume_url      TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1,
  notify_on_view  INTEGER NOT NULL DEFAULT 0,  -- 헤드헌터 조회 시 알림
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 채용 공고
CREATE TABLE IF NOT EXISTS job_postings (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id        INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  poster_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  job_type        TEXT NOT NULL DEFAULT 'full_time', -- full_time | part_time | contract | intern
  description     TEXT,
  requirements    TEXT,
  preferred       TEXT,
  location        TEXT,
  salary_range    TEXT,
  visibility      TEXT NOT NULL DEFAULT 'public',  -- public | group_only
  status          TEXT NOT NULL DEFAULT 'active',  -- active | closed | draft
  expires_at      DATETIME,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 채용 공고 지원
CREATE TABLE IF NOT EXISTS job_applications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  posting_id  INTEGER NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  applicant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending',  -- pending | reviewing | passed | failed
  cover_letter TEXT,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(posting_id, applicant_id)
);

-- 헤드헌터 프로필
CREATE TABLE IF NOT EXISTS headhunter_profiles (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  specialty       TEXT,    -- 전문 분야
  agency          TEXT,    -- 소속사
  bio             TEXT,
  success_count   INTEGER NOT NULL DEFAULT 0,  -- 채용 성사 건수
  is_public       INTEGER NOT NULL DEFAULT 1,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 컨택 크레딧 (헤드헌터)
CREATE TABLE IF NOT EXISTS contact_credits (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  balance     INTEGER NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 크레딧 트랜잭션 로그
CREATE TABLE IF NOT EXISTS credit_transactions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount        INTEGER NOT NULL,  -- 양수: 충전, 음수: 사용
  balance_after INTEGER NOT NULL,
  type          TEXT NOT NULL,     -- purchase | use | refund | bonus
  description   TEXT,
  target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- 크레딧 사용 대상
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 인재 풀 리스트 (헤드헌터 ATS)
CREATE TABLE IF NOT EXISTS talent_lists (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  headhunter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 인재 풀 항목
CREATE TABLE IF NOT EXISTS talent_list_items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id         INTEGER NOT NULL REFERENCES talent_lists(id) ON DELETE CASCADE,
  candidate_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'initial_contact',  -- initial_contact | in_progress | hired | on_hold
  memo            TEXT,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(list_id, candidate_id)
);

-- 헤드헌터 명함 조회 로그 (알림 발송용)
CREATE TABLE IF NOT EXISTS card_view_logs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  viewer_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id      INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  viewer_type  TEXT NOT NULL DEFAULT 'user',  -- user | headhunter
  notified     INTEGER NOT NULL DEFAULT 0,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_job_seekers_user_id ON job_seekers(user_id);
CREATE INDEX IF NOT EXISTS idx_job_seekers_visibility ON job_seekers(visibility);
CREATE INDEX IF NOT EXISTS idx_job_postings_group_id ON job_postings(group_id);
CREATE INDEX IF NOT EXISTS idx_job_postings_status ON job_postings(status);
CREATE INDEX IF NOT EXISTS idx_job_applications_posting_id ON job_applications(posting_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_applicant_id ON job_applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_contact_credits_user_id ON contact_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_talent_list_items_list_id ON talent_list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_card_view_logs_card_id ON card_view_logs(card_id);
CREATE INDEX IF NOT EXISTS idx_card_view_logs_viewer_id ON card_view_logs(viewer_id);
