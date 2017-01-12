DROP DATABASE IF EXISTS rapido;
CREATE DATABASE rapido;

\c rapido;

CREATE TABLE users (
  ID SERIAL PRIMARY KEY,
  uname VARCHAR,
  fname VARCHAR,
  lname VARCHAR,
  password VARCHAR
);
