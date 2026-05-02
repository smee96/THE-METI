-- ============================================================
-- METI DB Migration 0011: 미성년자 정책 단순화
-- 보호자 연결 복잡 구조 제거 → 그룹 초대 링크 기반 Lite 계정으로 변경
-- ============================================================

-- ── 1. 불필요 테이블 제거 ─────────────────────────────
-- user_guardians: 보호자-학생 연결 테이블 (불필요)
DROP TABLE IF EXISTS user_guardians;

-- guardian_invitations: 보호자 초대 테이블 (그룹 초대 링크로 통합)
DROP TABLE IF EXISTS guardian_invitations;

-- minor_activity_logs: 과도한 감사 로그 (불필요)
DROP TABLE IF EXISTS minor_activity_logs;

-- ── 2. group_members: 불필요 컬럼 제거 ───────────────
-- SQLite는 DROP COLUMN을 지원(3.35+)하나 Cloudflare D1 호환성을 위해
-- 데이터를 유지하되 애플리케이션 레이어에서 무시 처리
-- guardian_user_id, guardian_approved_at 컬럼은 NULL로 유지 (D1 제약)

-- ── 3. group_invite_links: 그룹 초대 링크 테이블 (신규) ──
-- 강사/관리자가 생성하는 그룹 전용 초대 링크
-- 미성년자는 이 링크를 통해서만 가입 가능
CREATE TABLE IF NOT EXISTS group_invite_links (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  token           TEXT UNIQUE NOT NULL,         -- UUID 초대 토큰 (링크용)
  group_id        INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_by      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- 링크 생성한 강사/관리자
  label           TEXT,                         -- 링크 구분용 라벨 (예: "2026년 봄 수영반")
  max_uses        INTEGER,                      -- 최대 사용 횟수 (NULL = 무제한)
  used_count      INTEGER NOT NULL DEFAULT 0,   -- 현재 사용 횟수
  expires_at      DATETIME,                     -- 만료일시 (NULL = 무기한)
  is_active       INTEGER NOT NULL DEFAULT 1,   -- 0: 비활성(링크 차단)
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── 4. users: invite_token 컬럼 추가 ─────────────────
-- 초대 링크로 가입한 유저의 최초 초대 토큰 기록 (추적용)
ALTER TABLE users ADD COLUMN invited_via_token TEXT; -- 가입에 사용된 초대 링크 token

-- ── 5. users: user_type 정책 변경 ────────────────────
-- ADULT (기본): 플랫폼 전체 이용 가능
-- MINOR: 초대 링크로 가입, 소속 그룹 기능만 이용 가능
-- 기존 컬럼 유지 (0010에서 이미 추가됨), 기본값은 ADULT

-- ── 6. 인덱스 ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_group_invite_links_token ON group_invite_links(token);
CREATE INDEX IF NOT EXISTS idx_group_invite_links_group_id ON group_invite_links(group_id);
CREATE INDEX IF NOT EXISTS idx_group_invite_links_created_by ON group_invite_links(created_by);
CREATE INDEX IF NOT EXISTS idx_users_invited_via_token ON users(invited_via_token);
