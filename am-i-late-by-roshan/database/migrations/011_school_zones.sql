-- School catchment zones. Rows below are SAMPLE clusters (a 350 m radius around
-- well-known school-dense neighbourhoods) so the feature works out of the box.
-- Replace/extend with official polygons (e.g. KHDA / ADEK open data) via
-- INSERT ... ST_GeogFromText('POLYGON((lng lat, ...))').
CREATE TABLE IF NOT EXISTS school_zones (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  emirate      TEXT NOT NULL,
  zone         GEOGRAPHY(Polygon, 4326) NOT NULL,
  am_start     TIME NOT NULL DEFAULT '06:45',
  am_end       TIME NOT NULL DEFAULT '08:15',
  pm_start     TIME NOT NULL DEFAULT '13:30',
  pm_end       TIME NOT NULL DEFAULT '15:30',
  school_days  SMALLINT[] NOT NULL DEFAULT '{1,2,3,4,5}',
  is_sample    BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS school_zones_zone_idx ON school_zones USING GIST (zone);

INSERT INTO school_zones (name, emirate, zone, is_sample)
SELECT v.name, v.emirate,
       ST_Buffer(ST_SetSRID(ST_MakePoint(v.lng, v.lat), 4326)::geography, 350)::geography,
       TRUE
FROM (VALUES
  ('Al Barsha 1 school cluster (sample)',        'Dubai',     25.1050, 55.2040),
  ('Al Warqa school cluster (sample)',           'Dubai',     25.1935, 55.4080),
  ('Mirdif school cluster (sample)',             'Dubai',     25.2190, 55.4205),
  ('Al Qusais school cluster (sample)',          'Dubai',     25.2780, 55.3880),
  ('Dubai Silicon Oasis schools (sample)',       'Dubai',     25.1245, 55.3855),
  ('Jumeirah Village school cluster (sample)',   'Dubai',     25.0620, 55.2090),
  ('Sharjah Muwaileh school cluster (sample)',   'Sharjah',   25.2985, 55.4595),
  ('Abu Dhabi Khalifa City schools (sample)',    'Abu Dhabi', 24.4185, 54.5790),
  ('Abu Dhabi Al Mushrif schools (sample)',      'Abu Dhabi', 24.4520, 54.3960)
) AS v(name, emirate, lat, lng)
WHERE NOT EXISTS (SELECT 1 FROM school_zones WHERE is_sample);
