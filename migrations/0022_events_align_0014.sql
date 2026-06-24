-- ============================================================
-- Migration 0022: events 테이블을 코드(0014 스키마)에 정렬
-- 배경: prod/staging의 events 는 0004 스키마(organizer_id/max_participants)로 생성됨.
--       0014의 CREATE TABLE IF NOT EXISTS 가 no-op 되어 created_by/capacity/point_cost 누락 →
--       행사 API 가 prod에서 500. 누락 컬럼을 추가하고 기존 데이터를 백필한다.
-- (organizer_id/max_participants 컬럼은 호환 위해 유지 — 신규 INSERT는 양쪽 모두 채움)
-- ============================================================

ALTER TABLE events ADD COLUMN created_by INTEGER REFERENCES users(id);
ALTER TABLE events ADD COLUMN capacity   INTEGER;                    -- NULL = 무제한
ALTER TABLE events ADD COLUMN point_cost INTEGER NOT NULL DEFAULT 0; -- 그룹 포인트 개설 비용

-- 기존 행 백필
UPDATE events SET created_by = organizer_id     WHERE created_by IS NULL;
UPDATE events SET capacity   = max_participants WHERE capacity   IS NULL AND max_participants IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);
