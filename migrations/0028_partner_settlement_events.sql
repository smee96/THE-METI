-- ============================================================
-- ELID DB Migration 0028: 해피트리 제휴 — 정산 통지 이벤트 원장
-- 근거: ELID_Reply_to_HappyTree_v0.1.md (2026-07-08 확정 회신) §1-3
--   · POST /api/v1/partner/settlement 수신분 저장 (유저 포인트 미적립)
--   · 멱등 키 = (partner_id, order_id) — 해피트리 outbox 백오프 재시도 대비
--   · 환불 역정산: settlement_amount 음수 허용
-- ============================================================

CREATE TABLE IF NOT EXISTS partner_settlement_events (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  partner_id        INTEGER NOT NULL REFERENCES partner_services(id) ON DELETE CASCADE,
  external_user_key TEXT NOT NULL,
  user_id           INTEGER REFERENCES users(id) ON DELETE SET NULL,
  event_type        TEXT NOT NULL,             -- star_purchase | star_purchase_refund
  amount            INTEGER NOT NULL,          -- 결제/환불 원금 (통화 최소단위, 항상 양수)
  currency          TEXT NOT NULL,             -- ISO 4217
  order_id          TEXT NOT NULL,             -- 파트너측 멱등 키 (이벤트당 유일)
  ref_order_id      TEXT,                      -- refund일 때 원 결제 order_id
  commission_rate   REAL NOT NULL,             -- 적용 수수료율 스냅샷
  settlement_amount INTEGER NOT NULL,          -- purchase: +floor(amount×rate) / refund: 음수
  billing_period    TEXT NOT NULL,             -- YYYY-MM
  occurred_at       DATETIME,                  -- 파트너측 발생 시각 (선택)
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(partner_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_pse_billing ON partner_settlement_events(partner_id, billing_period);

-- 파트너 슬러그: launch-token의 aud/partner_id 클레임 값 (해피트리 = 'happytree')
ALTER TABLE partner_services ADD COLUMN slug TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_services_slug
  ON partner_services(slug) WHERE slug IS NOT NULL;
