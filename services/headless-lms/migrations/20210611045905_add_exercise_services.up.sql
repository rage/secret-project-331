-- exercise services
CREATE TABLE exercise_services (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  public_url VARCHAR(255) NOT NULL,
  internal_url VARCHAR(255)
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON exercise_services FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE exercise_services IS 'Implements an exercise type. Tasks and user interfaces unique to the exercise type are delegated to these services.';
-- exercise_service_endpoints
CREATE TABLE exercise_service_info (
  exercise_service_id UUID PRIMARY KEY REFERENCES exercise_services,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  editor_iframe_path VARCHAR(255) NOT NULL,
  exercise_iframe_path VARCHAR(255) NOT NULL,
  grade_endpoint_path VARCHAR(255) NOT NULL
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON exercise_service_info FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE exercise_service_info IS 'Information that exercise service has reported';
