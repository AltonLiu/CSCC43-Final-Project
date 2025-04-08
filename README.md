Install dependencies: 
npm install

Initialize DB: 
psql -U postgres
CREATE DATABASE socialstocks;
\l
\q

Initialize Schemas: 
psql -d socialstocks -f db/schema.sql -U postgres

Configure:
create .env with credentials

Start server:
npm start

Access:
navigate to http://localhost:3000

Access tables:
psql -U postgres
\c socialstocks

Drop all tables:
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;#   C S C C 4 3 - F i n a l - P r o j e c t  
 