DROP TABLE IF EXISTS items;
CREATE TABLE items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  price REAL,
  url TEXT,
  image_key TEXT,
  category TEXT DEFAULT 'uncategorized',
  priority INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);
