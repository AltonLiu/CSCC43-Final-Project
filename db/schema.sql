SET search_path TO public;

-- Users
CREATE TABLE users (
  email TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  password TEXT NOT NULL
);

-- Portfolios
CREATE TABLE portfolios (
  pid SERIAL PRIMARY KEY,
  uid TEXT REFERENCES users(email) ON DELETE CASCADE,
  name TEXT NOT NULL,
  money NUMERIC(12,2) DEFAULT 0 NOT NULL
);

-- CREATE OR REPLACE FUNCTION create_initial_portfolio()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   INSERT INTO portfolios (uid, name, money)
--   VALUES (NEW.email, 'Personal', 0.00);
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- CREATE TRIGGER create_initial_portfolio
-- AFTER INSERT ON users
-- FOR EACH ROW
-- EXECUTE FUNCTION create_initial_portfolio();

-- Stocks
CREATE TABLE stocks (
  symbol TEXT PRIMARY KEY
);

-- Historical & new data unified view
CREATE TABLE stockdata (
  stock TEXT REFERENCES stocks(symbol) ON DELETE CASCADE,
  date DATE NOT NULL,
  open NUMERIC,
  high NUMERIC,
  low NUMERIC,
  close NUMERIC,
  volume BIGINT,
  PRIMARY KEY(stock, date)
);

-- Holdings
CREATE TABLE holdings (
  pid INTEGER REFERENCES portfolios(pid) ON DELETE CASCADE,
  stock TEXT REFERENCES stocks(symbol) ON DELETE CASCADE,
  shares INTEGER NOT NULL,
  PRIMARY KEY(pid, stock)
);

-- Stock Lists
CREATE TABLE stocklists (
  lid SERIAL PRIMARY KEY,
  uid TEXT REFERENCES users(email) ON DELETE CASCADE,
  name TEXT NOT NULL,
  visibility TEXT CHECK (visibility IN ('private','shared','public')) DEFAULT 'private'
);

CREATE TABLE stocklistitems (
  lid INTEGER REFERENCES stocklists(lid) ON DELETE CASCADE,
  stock TEXT REFERENCES stocks(symbol) ON DELETE CASCADE,
  shares INTEGER NOT NULL,
  PRIMARY KEY(lid, stock)
);

-- Friends
CREATE TABLE friends (
  sender TEXT REFERENCES users(email) ON DELETE CASCADE,
  receiver TEXT REFERENCES users(email) ON DELETE CASCADE,
  date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status TEXT CHECK (status IN ('pending','accepted','rejected')),
  PRIMARY KEY(sender, receiver)
);

-- Reviews
CREATE TABLE reviews (
  rid SERIAL PRIMARY KEY,
  lid INTEGER REFERENCES stocklists(lid) ON DELETE CASCADE,
  uid TEXT REFERENCES users(email) ON DELETE CASCADE,
  date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  text TEXT NOT NULL
);