-- ============================================================
-- Migration 0014: lessons, events, products, orders, payments
-- METI Service v1.4 (2026-05-06)
-- ============================================================

-- ── 1. group_members role 확장 (instructor 추가) ──────────
-- SQLite는 MODIFY COLUMN 미지원 → role 컬럼은 TEXT로 이미 선언되어 있으므로 별도 변경 불필요
-- instructor 값은 애플리케이션 레벨에서 허용

-- ── 2. lessons ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lessons (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id         INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  instructor_id    INTEGER NOT NULL REFERENCES users(id),
  title            TEXT    NOT NULL,
  description      TEXT,
  schedule_type    TEXT    NOT NULL DEFAULT 'one-time' CHECK(schedule_type IN ('one-time','repeat')),
  scheduled_at     DATETIME NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  capacity         INTEGER,                        -- NULL = 무제한
  location         TEXT,
  point_cost       INTEGER NOT NULL DEFAULT 500,   -- 그룹 포인트 개설 비용
  status           TEXT NOT NULL DEFAULT 'upcoming'
                   CHECK(status IN ('upcoming','ongoing','ended','cancelled')),
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lessons_group_id      ON lessons(group_id);
CREATE INDEX IF NOT EXISTS idx_lessons_instructor_id ON lessons(instructor_id);
CREATE INDEX IF NOT EXISTS idx_lessons_scheduled_at  ON lessons(scheduled_at);

-- ── 3. lesson_registrations ───────────────────────────────
CREATE TABLE IF NOT EXISTS lesson_registrations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id   INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'confirmed'
              CHECK(status IN ('confirmed','cancelled')),
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(lesson_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_reg_lesson_id ON lesson_registrations(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_reg_user_id   ON lesson_registrations(user_id);

-- ── 4. events ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id          INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_by        INTEGER NOT NULL REFERENCES users(id),
  title             TEXT    NOT NULL,
  description       TEXT,
  location          TEXT,
  starts_at         DATETIME NOT NULL,
  ends_at           DATETIME,
  capacity          INTEGER,                          -- NULL = 무제한
  visibility        TEXT NOT NULL DEFAULT 'group_only'
                    CHECK(visibility IN ('public','group_only')),
  registration_type TEXT NOT NULL DEFAULT 'free'
                    CHECK(registration_type IN ('free','pre_required')),
  entry_method      TEXT NOT NULL DEFAULT 'qr'
                    CHECK(entry_method IN ('qr','nfc_qr','manual')),
  point_cost        INTEGER NOT NULL DEFAULT 1000,    -- 그룹 포인트 개설 비용
  status            TEXT NOT NULL DEFAULT 'upcoming'
                    CHECK(status IN ('upcoming','ongoing','ended','cancelled')),
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_events_group_id  ON events(group_id);
CREATE INDEX IF NOT EXISTS idx_events_starts_at ON events(starts_at);
CREATE INDEX IF NOT EXISTS idx_events_status    ON events(status);

-- ── 5. event_participants ─────────────────────────────────
CREATE TABLE IF NOT EXISTS event_participants (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id   INTEGER NOT NULL REFERENCES events(id)  ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'confirmed'
             CHECK(status IN ('confirmed','cancelled')),
  joined_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_part_event_id ON event_participants(event_id);
CREATE INDEX IF NOT EXISTS idx_event_part_user_id  ON event_participants(user_id);

-- ── 6. products ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id    INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK(type IN ('lesson','event','etc')),
  target_id   INTEGER NOT NULL,   -- lesson_id or event_id
  title       TEXT NOT NULL,
  description TEXT,
  price       INTEGER NOT NULL,   -- 원(KRW)
  stock       INTEGER,            -- NULL = 무제한
  expires_days INTEGER,           -- 구매 후 이용 가능 기간(일), NULL = 무제한
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_group_id  ON products(group_id);
CREATE INDEX IF NOT EXISTS idx_products_type      ON products(type);
CREATE INDEX IF NOT EXISTS idx_products_target_id ON products(target_id);

-- ── 7. orders ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id),
  total_amount INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK(status IN ('pending','paid','cancelled','refunded')),
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status  ON orders(status);

-- ── 8. order_items ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER NOT NULL REFERENCES orders(id)   ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity   INTEGER NOT NULL DEFAULT 1,
  price      INTEGER NOT NULL,   -- 주문 시점 가격 스냅샷
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id   ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- ── 9. payments ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id       INTEGER NOT NULL REFERENCES orders(id),
  method         TEXT NOT NULL CHECK(method IN ('inapp_apple','inapp_google','web')),
  pg             TEXT,            -- 'toss' | 'portone' | NULL (inapp)
  pg_transaction_id TEXT,        -- PG사 거래 ID
  amount         INTEGER NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK(status IN ('pending','paid','failed','refunded')),
  paid_at        DATETIME,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status   ON payments(status);

-- ── 10. point_transactions type 확장 메모 ─────────────────
-- 기존 point_transactions.type 에 아래 값 추가 사용:
--   'lesson_open_cost'   레슨 개설 비용 (그룹 포인트 차감)
--   'event_open_cost'    행사 개설 비용 (그룹 포인트 차감)
--   'card_open_cost'     명함 개설 비용 (개인 포인트 차감)
