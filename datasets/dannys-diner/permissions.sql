-- Run as the database owner in each Diner database after loading its fixture.
DO $$ BEGIN
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='diner_practice') THEN
  CREATE ROLE diner_practice LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
 END IF;
END $$;
GRANT USAGE ON SCHEMA dannys_diner TO diner_practice;
GRANT SELECT ON ALL TABLES IN SCHEMA dannys_diner TO diner_practice;
ALTER ROLE diner_practice SET default_transaction_read_only=on;
ALTER ROLE diner_practice SET statement_timeout='5s';
