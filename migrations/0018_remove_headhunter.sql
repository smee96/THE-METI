-- Migration 0018: headhunter account_type 제거
-- account_type을 'personal' 단일로 통합
-- 기존 headhunter 유저는 personal로 전환

-- 1. 기존 headhunter 유저 → personal 전환
UPDATE users SET account_type = 'personal' WHERE account_type = 'headhunter';

-- 2. plans 테이블 features에서 headhunter 관련 플래그 제거
UPDATE plans SET features = json_remove(features, '$.headhunter')         WHERE code IN ('free','pro','business');
UPDATE plans SET features = json_remove(features, '$.advanced_recruiting') WHERE code IN ('free','pro','business');

-- 3. 검색/채팅 기능: 모든 플랜 허용 (플랜 제약 없음)
UPDATE plans SET features = json_set(features, '$.search', true, '$.chat', true)
  WHERE code IN ('free', 'pro', 'business');
