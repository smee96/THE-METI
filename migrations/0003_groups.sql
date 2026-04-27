-- ============================================================
-- METI DB Migration 0003: Groups (그룹/협회)
-- ============================================================

-- 그룹 테이블
CREATE TABLE IF NOT EXISTS groups (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  name              TEXT NOT NULL,
  description       TEXT,
  logo_url          TEXT,
  category          TEXT NOT NULL DEFAULT 'other',  -- association | company | club | other
  visibility        TEXT NOT NULL DEFAULT 'public', -- public | private
  status            TEXT NOT NULL DEFAULT 'pending', -- pending | active | suspended
  plan              TEXT NOT NULL DEFAULT 'free',    -- free | pro | business
  plan_expires_at   DATETIME,
  max_members       INTEGER,
  custom_join_fields TEXT,  -- JSON: 가입 신청 시 추가 입력 항목 설정
  admin_user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- 현재 관리자
  approved_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- 승인한 슈퍼관리자
  approved_at       DATETIME,
  is_featured       INTEGER NOT NULL DEFAULT 0,  -- 메인 피드 추천 노출
  is_deleted        INTEGER NOT NULL DEFAULT 0,
  deleted_at        DATETIME,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 그룹 멤버
CREATE TABLE IF NOT EXISTS group_members (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id        INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'member',  -- admin | sub_admin | executive | member
  custom_role     TEXT,                             -- 그룹별 커스텀 등급명
  status          TEXT NOT NULL DEFAULT 'pending', -- pending | active | rejected | left | kicked
  join_fields     TEXT,                             -- JSON: 가입 신청 시 입력한 추가 정보
  invited_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_at     DATETIME,
  joined_at       DATETIME,
  left_at         DATETIME,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(group_id, user_id)
);

-- 관리자 권한 이임 요청
CREATE TABLE IF NOT EXISTS group_admin_transfers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id        INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  from_user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending | accepted | rejected | expired
  requested_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at    DATETIME,
  expires_at      DATETIME NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 공지사항
CREATE TABLE IF NOT EXISTS notices (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id    INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  author_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  is_pinned   INTEGER NOT NULL DEFAULT 0,
  is_deleted  INTEGER NOT NULL DEFAULT 0,
  deleted_at  DATETIME,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 공지사항 읽음 처리
CREATE TABLE IF NOT EXISTS notice_reads (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  notice_id  INTEGER NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(notice_id, user_id)
);

-- 그룹 활동 사진 (협회 홍보용)
CREATE TABLE IF NOT EXISTS group_photos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id    INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  uploader_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_url   TEXT NOT NULL,
  caption     TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_groups_admin_user_id ON groups(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_groups_status ON groups(status);
CREATE INDEX IF NOT EXISTS idx_groups_category ON groups(category);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_status ON group_members(status);
CREATE INDEX IF NOT EXISTS idx_notices_group_id ON notices(group_id);
CREATE INDEX IF NOT EXISTS idx_notices_is_pinned ON notices(is_pinned);
CREATE INDEX IF NOT EXISTS idx_notice_reads_notice_id ON notice_reads(notice_id);
CREATE INDEX IF NOT EXISTS idx_notice_reads_user_id ON notice_reads(user_id);
