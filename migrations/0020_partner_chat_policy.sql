-- ============================================================
-- Migration 0020: 파트너 WebView URL + 채팅 플랜별 보관 정책
-- METI Service v1.7 (2026-05)
-- ============================================================

-- ── 1. partner_services: webview_url 컬럼 추가 ───────────────
-- WebView 방식으로 메티 앱 내에서 파트너 서비스(게임 등)를 로드할 URL
ALTER TABLE partner_services ADD COLUMN webview_url TEXT;

-- ── 2. 채팅 보관 정책 설정값 — plan_configs에 추가 ───────────
-- 플랜별 메시지 보관 일수 (0 = 무제한)
INSERT OR IGNORE INTO plan_configs (config_key, config_val, description) VALUES
  ('chat_retention_free',     '1',   '무료 플랜 채팅 메시지 보관 일수'),
  ('chat_retention_pro',      '90',  'Pro 플랜 채팅 메시지 보관 일수'),
  ('chat_retention_business', '0',   'Business 플랜 채팅 메시지 보관 일수 (0=무제한)');

-- ── 3. 인덱스 ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_partner_services_status ON partner_services(status);
