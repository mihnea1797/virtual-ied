ALTER TABLE sensor_data DROP CONSTRAINT sensor_data_pkey;
ALTER TABLE sensor_data ADD PRIMARY KEY (id, time);
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
SELECT create_hypertable('sensor_data', 'time');

