-- ============================================================
-- METI 테스트 계정 Seed
-- 로컬 & staging 환경 전용 — 절대 프로덕션에 실행 금지
--
-- 계정 정보:
--   일반 유저:  test@meti.dev  / MetiTest1234!
--   프로 유저:  pro@meti.dev   / MetiTest1234!
--   어드민:     admin@meti.dev / MetiAdmin1234!
-- ============================================================

-- 일반 테스트 유저 (이메일 인증 완료, free 플랜)
INSERT OR IGNORE INTO users (id, email, password_hash, name, account_type, plan, is_verified, is_active, role)
VALUES (
  9001,
  'test@meti.dev',
  'd40c38736eb29fa3aa508eac7a87470555f7f9fb4836cb710efe0a930be2d097',
  '테스트유저',
  'personal', 'free', 1, 1, 'user'
);

-- 슈퍼 어드민 계정
INSERT OR IGNORE INTO users (id, email, password_hash, name, account_type, plan, is_verified, is_active, role)
VALUES (
  9002,
  'admin@meti.dev',
  'e6bd92090a980228c96689f7175ce5985688f3cf795a3386cbedd5913e4cce73',
  '어드민',
  'personal', 'business', 1, 1, 'super_admin'
);

-- pro 플랜 테스트 유저
INSERT OR IGNORE INTO users (id, email, password_hash, name, account_type, plan, is_verified, is_active, role)
VALUES (
  9003,
  'pro@meti.dev',
  'd40c38736eb29fa3aa508eac7a87470555f7f9fb4836cb710efe0a930be2d097',
  '프로유저',
  'personal', 'pro', 1, 1, 'user'
);

-- 테스트 유저 기본 명함 (is_primary 컬럼)
INSERT OR IGNORE INTO cards (id, user_id, name, title, company, email, phone, is_active, is_primary)
VALUES (9001, 9001, '테스트유저', '개발팀', 'METI Corp', 'test@meti.dev', '010-0000-0001', 1, 1);

-- 프로 유저 기본 명함
INSERT OR IGNORE INTO cards (id, user_id, name, title, company, email, phone, is_active, is_primary)
VALUES (9002, 9003, '프로유저', '기획팀', 'METI Corp', 'pro@meti.dev', '010-0000-0002', 1, 1);

-- 테스트 그룹 (active 상태, admin_user_id 컬럼)
INSERT OR IGNORE INTO groups (id, name, description, category, visibility, status, admin_user_id)
VALUES (9001, '테스트그룹', '자동화 테스트용 그룹', 'other', 'public', 'active', 9001);

-- 테스트 유저를 그룹 admin으로
INSERT OR IGNORE INTO group_members (group_id, user_id, role, status)
VALUES (9001, 9001, 'admin', 'active');

-- 포인트 지갑 (테스트 유저)
INSERT OR IGNORE INTO point_wallets (id, owner_type, owner_id, balance)
VALUES (9001, 'user', 9001, 50000);

-- 포인트 지갑 (테스트 그룹)
INSERT OR IGNORE INTO point_wallets (id, owner_type, owner_id, balance)
VALUES (9002, 'group', 9001, 100000);
