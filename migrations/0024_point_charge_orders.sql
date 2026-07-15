-- ════════════════════════════════════════════════════════════
-- 0024: 포인트 충전 주문 (토스페이먼츠 웹 결제)
--
-- 플로우: 주문생성(pending) → 토스 결제창 → 서버 confirm(토스 승인 API)
--        → status=paid + creditWallet 지급
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS point_charge_orders (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  order_uid         TEXT    NOT NULL UNIQUE,          -- 토스 orderId (CHG-...)
  user_id           INTEGER NOT NULL,                 -- 결제자
  owner_type        TEXT    NOT NULL DEFAULT 'user'   -- 지급 대상 지갑
                    CHECK (owner_type IN ('user','group')),
  owner_id          INTEGER NOT NULL,
  charge_product_id INTEGER,                          -- point_charge_products.id (직접입력이면 해당 상품)
  amount_krw        INTEGER NOT NULL,                 -- 결제 금액 (원)
  points            INTEGER NOT NULL,                 -- 지급 포인트
  status            TEXT    NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','paid','failed','canceled')),
  pg                TEXT    NOT NULL DEFAULT 'toss',
  payment_key       TEXT,                             -- 토스 paymentKey
  approved_at       DATETIME,
  fail_reason       TEXT,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pco_user   ON point_charge_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_pco_status ON point_charge_orders(status);
