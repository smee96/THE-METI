-- ============================================================
-- Migration 0015: events.entry_fee 컬럼 추가
-- METI Service v1.4 (2026-05-06)
-- ============================================================

ALTER TABLE events ADD COLUMN entry_fee INTEGER NOT NULL DEFAULT 0;
