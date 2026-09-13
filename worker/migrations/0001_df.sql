-- Depot Finder corrections. Lives in the shared bottle-count D1 database; every
-- object is prefixed df_ so it cannot collide with that app's tables.
CREATE TABLE IF NOT EXISTS df_corrections (
  id       TEXT PRIMARY KEY,
  depot_id TEXT NOT NULL,
  field    TEXT NOT NULL,
  proposed TEXT NOT NULL,
  note     TEXT,
  contact  TEXT,
  created  TEXT NOT NULL,
  ip_hash  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS df_corrections_ip_created ON df_corrections (ip_hash, created);
CREATE INDEX IF NOT EXISTS df_corrections_field ON df_corrections (field);
