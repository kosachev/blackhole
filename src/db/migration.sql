CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY,
  shipping_date INTEGER,
  status TEXT NOT NULL DEFAULT '',
  good_category TEXT NOT NULL DEFAULT '',
  good_sku TEXT NOT NULL DEFAULT '',
  good_name TEXT NOT NULL DEFAULT '',
  good_size TEXT NOT NULL DEFAULT '',
  price REAL,
  discount TEXT NOT NULL DEFAULT '',
  customer_delivery_price REAL,
  owner_delivery_price REAL,
  owner_return_delivery_price REAL,
  delivery_type TEXT NOT NULL DEFAULT '',
  payment_type TEXT NOT NULL DEFAULT '',
  lead_id TEXT NOT NULL DEFAULT '',
  cdek_number TEXT NOT NULL DEFAULT '',
  return_lead_id TEXT NOT NULL DEFAULT '',
  return_cdek_number TEXT NOT NULL DEFAULT '',
  closed_by_register TEXT NOT NULL DEFAULT '',
  return_closed_by_register TEXT NOT NULL DEFAULT '',
  checkout TEXT NOT NULL DEFAULT '',
  ads TEXT NOT NULL DEFAULT '',
  site TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_sales_lead_id ON sales(lead_id);
CREATE INDEX IF NOT EXISTS idx_sales_return_lead_id ON sales(return_lead_id);
CREATE INDEX IF NOT EXISTS idx_sales_cdek_number ON sales(cdek_number);
CREATE INDEX IF NOT EXISTS idx_sales_return_cdek_number ON sales(return_cdek_number);
CREATE INDEX IF NOT EXISTS idx_sales_good_sku ON sales(good_sku);

CREATE TABLE IF NOT EXISTS spendings (
  id INTEGER PRIMARY KEY,
  date INTEGER,
  description TEXT NOT NULL DEFAULT '',
  amount REAL
);

CREATE TABLE IF NOT EXISTS kpi (
  id INTEGER PRIMARY KEY,
  kpi_reached_at INTEGER,
  lead_created_at INTEGER,
  lead_id TEXT NOT NULL DEFAULT '',
  responsible_user TEXT NOT NULL DEFAULT '',
  status_user TEXT NOT NULL DEFAULT '',
  kpi_type TEXT NOT NULL DEFAULT '',
  price REAL
);

CREATE TABLE IF NOT EXISTS cdek_price (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  delta REAL NOT NULL
);
