-- ============================================================
-- METI DB Migration 0010: Minor / Guardian / Group Lesson
-- 미성년자 보호 및 그룹 레슨 기능
-- ============================================================

-- ── 1. users 테이블: user_type 컬럼 추가 ─────────────────
-- ADULT(성인) | MINOR(미성년자)
ALTER TABLE users ADD COLUMN user_type TEXT NOT NULL DEFAULT 'ADULT';

-- 기존 유저 기본값 설정
UPDATE users SET user_type = 'ADULT' WHERE user_type IS NULL;

-- ── 2. users 테이블: 생년월일 추가 (미성년자 판별용) ──────
ALTER TABLE users ADD COLUMN birth_date TEXT;         -- YYYY-MM-DD 형식
ALTER TABLE users ADD COLUMN phone TEXT;              -- 전화번호 (미성년자 숨김 대상)

-- ── 3. user_guardians: 보호자-학생 연결 테이블 ───────────
CREATE TABLE IF NOT EXISTS user_guardians (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- 학생(MINOR)
  guardian_user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- 보호자/강사(ADULT)
  relation          TEXT NOT NULL DEFAULT 'parent',  -- parent | teacher
  status            TEXT NOT NULL DEFAULT 'pending', -- pending | active | rejected
  invited_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  accepted_at       DATETIME,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, guardian_user_id)
);

-- ── 4. groups 테이블: group_type 컬럼 추가 ───────────────
-- NORMAL(일반 그룹) | LESSON(레슨/스터디 그룹)
ALTER TABLE groups ADD COLUMN group_type TEXT NOT NULL DEFAULT 'NORMAL';

-- LESSON 그룹 전용 설정 컬럼
ALTER TABLE groups ADD COLUMN lesson_config TEXT;
-- lesson_config JSON 예시:
-- {
--   "allow_minor": true,          -- 미성년자 참여 허용 여부
--   "require_guardian": true,     -- 보호자 동의 필수 여부
--   "subject": "피아노",           -- 레슨 과목
--   "schedule": "매주 화/목 오후 3시",  -- 스케줄 텍스트
--   "lesson_fee": 0               -- 레슨비 (0=무료)
-- }

-- ── 5. group_members: role 확장 ──────────────────────────
-- 기존: admin | sub_admin | executive | member
-- 추가: minor (미성년자 멤버 식별용)
-- ※ SQLite는 CHECK 수정 불가 → 애플리케이션 레이어에서 제어

-- minor 멤버용 보호자 연결 컬럼 추가
ALTER TABLE group_members ADD COLUMN guardian_user_id INTEGER
  REFERENCES users(id) ON DELETE SET NULL;  -- MINOR 멤버의 보호자

ALTER TABLE group_members ADD COLUMN guardian_approved_at DATETIME; -- 보호자 동의 일시

-- ── 6. guardian_invitations: 보호자 초대 토큰 테이블 ─────
CREATE TABLE IF NOT EXISTS guardian_invitations (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  token           TEXT UNIQUE NOT NULL,           -- 초대 링크용 UUID 토큰
  group_id        INTEGER REFERENCES groups(id) ON DELETE CASCADE,
  minor_user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_by      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- 강사/관리자
  guardian_email  TEXT,                           -- 초대할 보호자 이메일
  status          TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | expired
  expires_at      DATETIME NOT NULL,
  accepted_at     DATETIME,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── 7. lesson_schedules: 레슨 일정 테이블 ───────────────
CREATE TABLE IF NOT EXISTS lesson_schedules (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id        INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,                 -- 레슨 제목 (예: "3월 2주차 피아노 레슨")
  description     TEXT,
  instructor_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- 강사
  starts_at       DATETIME NOT NULL,
  ends_at         DATETIME,
  location        TEXT,
  max_students    INTEGER,
  status          TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | ongoing | completed | cancelled
  is_deleted      INTEGER NOT NULL DEFAULT 0,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── 8. lesson_attendances: 레슨 출석 테이블 ─────────────
CREATE TABLE IF NOT EXISTS lesson_attendances (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_id     INTEGER NOT NULL REFERENCES lesson_schedules(id) ON DELETE CASCADE,
  student_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'absent', -- present | absent | late | excused
  checked_by      INTEGER REFERENCES users(id) ON DELETE SET NULL, -- 출석 처리한 강사
  checked_at      DATETIME,
  note            TEXT,                           -- 특이사항 메모
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(schedule_id, student_id)
);

-- ── 9. minor_activity_logs: 미성년자 활동 감사 로그 ──────
CREATE TABLE IF NOT EXISTS minor_activity_logs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  minor_user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  guardian_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action          TEXT NOT NULL,  -- group_join | message_sent | card_shared | profile_viewed
  target_type     TEXT,           -- group | user | card | message
  target_id       INTEGER,
  ip_address      TEXT,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── 인덱스 ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_user_type ON users(user_type);
CREATE INDEX IF NOT EXISTS idx_user_guardians_user_id ON user_guardians(user_id);
CREATE INDEX IF NOT EXISTS idx_user_guardians_guardian_id ON user_guardians(guardian_user_id);
CREATE INDEX IF NOT EXISTS idx_user_guardians_status ON user_guardians(status);
CREATE INDEX IF NOT EXISTS idx_groups_group_type ON groups(group_type);
CREATE INDEX IF NOT EXISTS idx_guardian_invitations_token ON guardian_invitations(token);
CREATE INDEX IF NOT EXISTS idx_guardian_invitations_minor ON guardian_invitations(minor_user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_schedules_group_id ON lesson_schedules(group_id);
CREATE INDEX IF NOT EXISTS idx_lesson_schedules_instructor ON lesson_schedules(instructor_id);
CREATE INDEX IF NOT EXISTS idx_lesson_schedules_starts_at ON lesson_schedules(starts_at);
CREATE INDEX IF NOT EXISTS idx_lesson_attendances_schedule ON lesson_attendances(schedule_id);
CREATE INDEX IF NOT EXISTS idx_lesson_attendances_student ON lesson_attendances(student_id);
CREATE INDEX IF NOT EXISTS idx_minor_activity_logs_minor ON minor_activity_logs(minor_user_id);
