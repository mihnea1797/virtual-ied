CREATE OR REPLACE FUNCTION notify_rms_insert() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('rms_channel', 'new_data');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rms_insert_trigger
AFTER INSERT ON sensor_data
FOR EACH STATEMENT
EXECUTE FUNCTION notify_rms_insert();
