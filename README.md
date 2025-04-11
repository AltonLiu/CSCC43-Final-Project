Install dependencies:
```
npm install
```

Initialize DB (you need to replace the full path to stocks.csv and stockdata.csv for your machine below):
```
psql -U postgres
CREATE DATABASE socialstocks;
\l
\q
```

Initialize Schemas:
```
psql -d socialstocks -f db/schema.sql -U postgres
```

Initialize stock and stockdata tables:
```
psql -U postgres
\c socialstocks
\copy stocks(symbol) FROM 'C:\Users\super\Desktop\CSCC43\project\stocks.csv' DELIMITER ',' CSV HEADER;
\copy stockdata(stock, date, open, high, low, close, volume) FROM 'C:\Users\super\Desktop\CSCC43\project\stockdata.csv' DELIMITER ',' CSV HEADER;
\q
```

Create .env file with these contents:
```
PORT=3000
DATABASE_URL=postgres://postgres:postgres@localhost:5432/socialstocks
JWT_SECRET=your_jwt_secret
```

Start server:
```
npm start
```

Start dev server:
```
npm run dev
```

Run application:
navigate to http://localhost:3000

Access tables:
```
psql -U postgres
\c socialstocks
```

Drop all tables:
```
psql -U postgres
\c socialstocks
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
\q
```
