-- ============================================================
-- METI DB Migration 0019: NFC 실물카드 배송정보 및 디자인 컬럼 추가
-- ============================================================

-- nfc_physical_cards 테이블에 디자인·배송 컬럼 추가
ALTER TABLE nfc_physical_cards ADD COLUMN design_type TEXT NOT NULL DEFAULT 'basic';
  -- basic | premium | custom (추후 확장)

ALTER TABLE nfc_physical_cards ADD COLUMN shipping_name    TEXT;      -- 수령인 이름
ALTER TABLE nfc_physical_cards ADD COLUMN shipping_phone   TEXT;      -- 수령인 연락처
ALTER TABLE nfc_physical_cards ADD COLUMN shipping_zipcode TEXT;      -- 우편번호
ALTER TABLE nfc_physical_cards ADD COLUMN shipping_address TEXT;      -- 기본 주소
ALTER TABLE nfc_physical_cards ADD COLUMN shipping_detail  TEXT;      -- 상세 주소
ALTER TABLE nfc_physical_cards ADD COLUMN shipping_memo    TEXT;      -- 배송 메모
ALTER TABLE nfc_physical_cards ADD COLUMN tracking_no      TEXT;      -- 운송장 번호
ALTER TABLE nfc_physical_cards ADD COLUMN carrier          TEXT;      -- 택배사 (cjlogistics | hanjin | lotte | epost | etc)
ALTER TABLE nfc_physical_cards ADD COLUMN amount           INTEGER NOT NULL DEFAULT 0;  -- 결제금액(원)
ALTER TABLE nfc_physical_cards ADD COLUMN payment_status   TEXT NOT NULL DEFAULT 'unpaid';
  -- unpaid | paid | refunded
ALTER TABLE nfc_physical_cards ADD COLUMN payment_key      TEXT;      -- Toss/Stripe 결제키 (Phase 2)
ALTER TABLE nfc_physical_cards ADD COLUMN admin_memo       TEXT;      -- 어드민 처리 메모
ALTER TABLE nfc_physical_cards ADD COLUMN shipped_at       DATETIME;  -- 발송 일시
