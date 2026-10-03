CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id BIGSERIAL UNIQUE,
  family_code VARCHAR(12) NOT NULL,
  member_name VARCHAR(100) NOT NULL,
  phone_number VARCHAR(10) NOT NULL,
  guest_count INTEGER NOT NULL CHECK (guest_count BETWEEN 1 AND 20),
  check_in DATE NOT NULL CHECK (check_in BETWEEN DATE '2026-11-20' AND DATE '2026-11-22'),
  check_out DATE NOT NULL CHECK (check_out BETWEEN DATE '2026-11-22' AND DATE '2026-11-23'),
  status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Confirmed','Cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (check_out >= check_in)
);

CREATE INDEX IF NOT EXISTS idx_reg_family_code ON registrations(family_code);
CREATE INDEX IF NOT EXISTS idx_reg_phone ON registrations(phone_number);
CREATE INDEX IF NOT EXISTS idx_reg_status ON registrations(status);
CREATE INDEX IF NOT EXISTS idx_reg_dates ON registrations(check_in, check_out);
