-- ============================================================
-- METI DB Migration 0012: 그룹 정책 단순화
-- - 그룹 생성: category 제거 → purpose(용도) 텍스트로
-- - 어드민 승인 시 미성년자 포함 여부 체크
-- - 그룹 멤버: is_minor, birth_date 추가 (레슨 그룹 가입 시 선택)
-- - users: user_type, birth_date, invited_via_token 제거 (단순화)
-- - 명함: is_public 기본값 0 (비공개)
-- ============================================================

-- ── 1. groups: category → purpose 대체 ───────────────
-- purpose: 그룹 용도 설명 (어드민 심사용)
ALTER TABLE groups ADD COLUMN purpose TEXT;
-- has_minor: 어드민이 승인 시 미성년자 포함 여부 체크 (0|1|null)
-- null = 미확인, 0 = 성인만, 1 = 미성년자 포함
ALTER TABLE groups ADD COLUMN has_minor INTEGER;

-- ── 2. group_members: 미성년자 관련 필드 추가 ─────────
-- is_minor: 레슨 그룹 가입 시 선택 입력 (0|1, 기본 null)
ALTER TABLE group_members ADD COLUMN is_minor INTEGER;
-- birth_date: 레슨 그룹 가입 시 선택 입력 (YYYY-MM-DD)
ALTER TABLE group_members ADD COLUMN birth_date TEXT;

-- ── 3. users: 불필요 컬럼 무력화 (SQLite DROP 제약) ──
-- user_type, invited_via_token 은 애플리케이션에서 무시
-- (D1은 DROP COLUMN 미지원 버전 존재 → 컬럼 유지, 앱에서 무시)

-- ── 4. group_invite_links: 모든 그룹 초대 링크 지원 ──
-- (0011에서 이미 생성됨, 별도 변경 없음)
-- group_type 컬럼 없이 모든 그룹에서 사용 가능

-- ── 5. 인덱스 추가 ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_groups_has_minor ON groups(has_minor);
CREATE INDEX IF NOT EXISTS idx_group_members_is_minor ON group_members(is_minor);
