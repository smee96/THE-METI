-- 사용자 역할 컬럼 추가 (슈퍼어드민 구분용)
ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';

-- 기존 유저 기본값 설정
UPDATE users SET role = 'user' WHERE role IS NULL;
