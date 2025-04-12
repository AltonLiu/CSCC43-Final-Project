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

-- Stocks
CREATE TABLE stocks (
  symbol TEXT PRIMARY KEY
);

-- Historical & new data unified view
CREATE TABLE stockdata (
  stock TEXT REFERENCES stocks(symbol) ON DELETE CASCADE,
  date DATE NOT NULL,
  open NUMERIC NOT NULL,
  high NUMERIC NOT NULL,
  low NUMERIC NOT NULL,
  close NUMERIC NOT NULL,
  volume BIGINT NOT NULL,
  PRIMARY KEY(stock, date)
);

-- Holdings
CREATE TABLE holdings (
  tid SERIAL PRIMARY KEY,
  pid INTEGER REFERENCES portfolios(pid) ON DELETE CASCADE,
  stock TEXT REFERENCES stocks(symbol) ON DELETE CASCADE,
  shares INTEGER NOT NULL
);

CREATE TABLE cashtransactions (
  tid SERIAL PRIMARY KEY,
  pid INTEGER REFERENCES portfolios(pid) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  source TEXT,
  destination TEXT
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

CREATE TABLE stocklistsharedwith (
  lid INTEGER REFERENCES stocklists(lid) ON DELETE CASCADE,
  uid TEXT REFERENCES users(email) ON DELETE CASCADE,
  PRIMARY KEY(lid, uid)
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
  lid INTEGER REFERENCES stocklists(lid) ON DELETE CASCADE,
  uid TEXT REFERENCES users(email) ON DELETE CASCADE,
  date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  text TEXT NOT NULL,
  PRIMARY KEY(lid, uid)
);
