-- ============================================================
-- ELID DB Migration 0023: 파트너 게임 여는 방식(open_mode)
--   · webview  = ELID 앱 내 인앱 WebView로 구동 (기본)
--   · external = 외부 브라우저로 완전 이동
-- 제휴 탭의 게임별로 여는 방식을 다르게 설정하기 위함
-- (단순 미니게임=webview, 유료재화 게임 심사 리스크 시 external)
-- ============================================================

ALTER TABLE partner_services ADD COLUMN open_mode TEXT NOT NULL DEFAULT 'webview';
