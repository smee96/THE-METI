-- ════════════════════════════════════════════════════════════
-- 0025: NFC 실물카드 신청 가격 설정 (포인트 차감 방식)
-- 어드민 plan_configs에서 변경 가능
-- ════════════════════════════════════════════════════════════

INSERT OR IGNORE INTO plan_configs (config_key, config_val, description) VALUES
  ('nfc_card_price_basic', '10000', 'NFC 실물카드 신청 가격 (포인트, basic 디자인)');
