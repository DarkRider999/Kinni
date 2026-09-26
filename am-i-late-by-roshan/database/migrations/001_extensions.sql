-- Core extensions. PostGIS powers every lat/lng column (GEOGRAPHY, SRID 4326);
-- pgcrypto provides gen_random_uuid().
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
