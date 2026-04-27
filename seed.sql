-- ============================================================
-- METI Seed Data (개발/테스트용)
-- ============================================================

-- 슈퍼 관리자 계정
-- 비밀번호: Admin1234! (bcrypt 해시)
INSERT OR IGNORE INTO users (id, email, password_hash, name, account_type, plan, is_verified, is_active) VALUES
  (1, 'super@meti.io', '$2b$10$placeholderHashForSuperAdmin', 'METI Super Admin', 'personal', 'business', 1, 1);

-- 테스트 유저들
INSERT OR IGNORE INTO users (id, email, password_hash, name, account_type, plan, is_verified) VALUES
  (2, 'alice@test.com',   '$2b$10$placeholderHashForTest', 'Alice Kim',    'personal',    'pro',  1),
  (3, 'bob@test.com',     '$2b$10$placeholderHashForTest', 'Bob Lee',      'personal',    'free', 1),
  (4, 'hunter@test.com',  '$2b$10$placeholderHashForTest', 'Headhunter Jo','headhunter',  'business', 1),
  (5, 'admin@group.com',  '$2b$10$placeholderHashForTest', 'Group Admin',  'personal',    'pro',  1);

-- 테스트 그룹
INSERT OR IGNORE INTO groups (id, name, description, category, visibility, status, admin_user_id, approved_by, approved_at) VALUES
  (1, '한국 스타트업 협회', '스타트업 생태계를 함께 만들어가는 협회입니다.', 'association', 'public', 'active', 5, 1, CURRENT_TIMESTAMP),
  (2, 'METI 테크 클럽',    '개발자 및 기술 전문가 모임', 'club', 'public', 'active', 2, 1, CURRENT_TIMESTAMP);

-- 그룹 멤버
INSERT OR IGNORE INTO group_members (group_id, user_id, role, status, joined_at) VALUES
  (1, 5, 'admin',  'active', CURRENT_TIMESTAMP),
  (1, 2, 'member', 'active', CURRENT_TIMESTAMP),
  (1, 3, 'member', 'active', CURRENT_TIMESTAMP),
  (2, 2, 'admin',  'active', CURRENT_TIMESTAMP),
  (2, 3, 'member', 'active', CURRENT_TIMESTAMP);

-- 테스트 명함
INSERT OR IGNORE INTO cards (id, user_id, card_type, name, title, company, email, phone, is_primary, is_active) VALUES
  (1, 2, 'personal', 'Alice Kim',   'CTO',            'TechStartup Inc', 'alice@test.com',  '010-1234-5678', 1, 1),
  (2, 3, 'personal', 'Bob Lee',     'Product Manager', 'MediaCorp',       'bob@test.com',    '010-9876-5432', 1, 1),
  (3, 4, 'personal', 'Headhunter Jo', '헤드헌터',      'TalentAgency',    'hunter@test.com', '010-5555-4444', 1, 1),
  (4, 5, 'personal', 'Group Admin', '협회장',          '한국 스타트업 협회', 'admin@group.com', '010-1111-2222', 1, 1),
  (5, 2, 'group',    'Alice Kim',   'CTO',            'METI 테크 클럽',   'alice@test.com',  '010-1234-5678', 0, 1);

-- 명함 SNS 링크
INSERT OR IGNORE INTO card_sns_links (card_id, platform, url, sort_order) VALUES
  (1, 'linkedin',  'https://linkedin.com/in/alice-kim', 0),
  (1, 'github',    'https://github.com/alice-kim',       1);

-- 파트너 서비스 (HappyTree)
INSERT OR IGNORE INTO partner_services (id, name, description, api_key, status) VALUES
  (1, 'HappyTree', '복지 포인트 제휴 서비스', 'ht_live_key_placeholder_change_before_production', 'active');

-- 리워드 잔액 초기화
INSERT OR IGNORE INTO reward_balances (user_id, points) VALUES (2, 150), (3, 50), (4, 0), (5, 200);

-- 크레딧 초기화 (헤드헌터)
INSERT OR IGNORE INTO contact_credits (user_id, balance) VALUES (4, 10);

-- 헤드헌터 프로필
INSERT OR IGNORE INTO headhunter_profiles (user_id, specialty, agency, bio, success_count) VALUES
  (4, 'IT/개발', 'TalentAgency', '10년 경력의 IT 전문 헤드헌터입니다.', 42);

-- 구직 프로필
INSERT OR IGNORE INTO job_seekers (user_id, visibility, desired_jobs, career_years, skills, locations) VALUES
  (3, 'public', '["프로덕트 매니저", "서비스 기획"]', 5, '["Figma", "SQL", "Jira"]', '["서울", "경기"]');

-- 테스트 행사
INSERT OR IGNORE INTO events (id, group_id, organizer_id, title, description, location, starts_at, ends_at, visibility, entry_method) VALUES
  (1, 1, 5, '2026 스타트업 네트워킹 나이트', '스타트업 관계자들의 네트워킹 행사', '서울 강남구 삼성동', '2026-05-15 18:00:00', '2026-05-15 21:00:00', 'public', 'qr');

-- 공지사항
INSERT OR IGNORE INTO notices (group_id, author_id, title, content, is_pinned) VALUES
  (1, 5, '[필독] 2026년 운영 계획 안내', '안녕하세요. 올해 협회 운영 계획을 공유드립니다...', 1),
  (1, 5, '5월 네트워킹 행사 참가 신청 안내', '5월 15일 네트워킹 행사 참가 신청을 받습니다.', 0);
