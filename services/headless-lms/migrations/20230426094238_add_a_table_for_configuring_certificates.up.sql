CREATE TYPE certificate_paper_size AS ENUM ('horizontal-a4', 'vertical-a4');
CREATE type certificate_text_anchor AS ENUM ('start', 'middle', 'end');
CREATE TABLE course_module_certificate_configurations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  course_module_id UUID NOT NULL REFERENCES course_modules(id),
  course_instance_id UUID REFERENCES course_instances(id),
  certificate_owner_name_y_pos VARCHAR(255) NOT NULL DEFAULT '70%',
  certificate_owner_name_x_pos VARCHAR(255) NOT NULL DEFAULT '50%',
  certificate_owner_name_font_size VARCHAR(255) NOT NULL DEFAULT '150px',
  certificate_owner_name_text_color VARCHAR(255) NOT NULL DEFAULT 'black',
  certificate_owner_name_text_anchor certificate_text_anchor NOT NULL DEFAULT 'middle',
  certificate_validate_url_y_pos VARCHAR(255) NOT NULL DEFAULT '80%',
  certificate_validate_url_x_pos VARCHAR(255) NOT NULL DEFAULT '88.5%',
  certificate_validate_url_font_size VARCHAR(255) NOT NULL DEFAULT '30px',
  certificate_validate_url_text_color VARCHAR(255) NOT NULL DEFAULT 'black',
  certificate_validate_url_text_anchor certificate_text_anchor NOT NULL DEFAULT 'end',
  certificate_date_y_pos VARCHAR(255) NOT NULL DEFAULT '88.5%',
  certificate_date_x_pos VARCHAR(255) NOT NULL DEFAULT '15%',
  certificate_date_font_size VARCHAR(255) NOT NULL DEFAULT '30px',
  certificate_date_text_color VARCHAR(255) NOT NULL DEFAULT 'black',
  certificate_date_text_anchor certificate_text_anchor NOT NULL DEFAULT 'start',
  certificate_locale VARCHAR(255) NOT NULL DEFAULT 'en',
  paper_size certificate_paper_size NOT NULL DEFAULT 'horizontal-a4',
  background_svg_path VARCHAR(255) NOT NULL,
  background_svg_file_upload_id UUID NOT NULL REFERENCES file_uploads(id),
  overlay_svg_path VARCHAR(255) NOT NULL,
  overlay_svg_file_upload_id UUID NOT NULL REFERENCES file_uploads(id)
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON course_module_certificate_configurations FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE course_module_certificate_configurations IS 'Configures how a certificate should be rendered. Can be used to change certificate background, certificate overlay, font sizes, font positions, etc.';
COMMENT ON COLUMN course_module_certificate_configurations.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN course_module_certificate_configurations.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN course_module_certificate_configurations.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN course_module_certificate_configurations.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN course_module_certificate_configurations.course_module_id IS 'The course module for which the certificate will be generated.';
COMMENT ON COLUMN course_module_certificate_configurations.course_instance_id IS 'If null, the configuration is for all the course instances that contain the course module. If not null, the configuration is only for a specific course instance.';
COMMENT ON COLUMN course_module_certificate_configurations.certificate_owner_name_y_pos IS 'The y position of the certificate owner name.';
COMMENT ON COLUMN course_module_certificate_configurations.certificate_owner_name_x_pos IS 'The x position of the certificate owner name.';
COMMENT ON COLUMN course_module_certificate_configurations.certificate_owner_name_font_size IS 'The font size of the certificate owner name.';
COMMENT ON COLUMN course_module_certificate_configurations.certificate_owner_name_text_color IS 'The color of the certificate owner name.';
COMMENT ON COLUMN course_module_certificate_configurations.certificate_owner_name_text_anchor IS 'How the owner name should be aligned relative to the given x and y positions. See https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/text-anchor.';
COMMENT ON COLUMN course_module_certificate_configurations.certificate_validate_url_y_pos IS 'The y position of the certificate validate url.';
COMMENT ON COLUMN course_module_certificate_configurations.certificate_validate_url_x_pos IS 'The x position of the certificate validate url.';
COMMENT ON COLUMN course_module_certificate_configurations.certificate_validate_url_font_size IS 'The font size of the certificate validate url.';
COMMENT ON COLUMN course_module_certificate_configurations.certificate_validate_url_text_color IS 'The color of the certificate validate url.';
COMMENT ON COLUMN course_module_certificate_configurations.certificate_validate_url_text_anchor IS 'How the validate url should be aligned relative to the given x and y positions. See https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/text-anchor.';
COMMENT ON COLUMN course_module_certificate_configurations.certificate_date_y_pos IS 'The y position of the certificate date.';
COMMENT ON COLUMN course_module_certificate_configurations.certificate_date_x_pos IS 'The x position of the certificate date.';
COMMENT ON COLUMN course_module_certificate_configurations.certificate_date_font_size IS 'The font size of the certificate date.';
COMMENT ON COLUMN course_module_certificate_configurations.certificate_date_text_color IS 'The color of the certificate date.';
COMMENT ON COLUMN course_module_certificate_configurations.certificate_date_text_anchor IS 'How the date should be aligned relative to the given x and y positions. See https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/text-anchor.';
COMMENT ON COLUMN course_module_certificate_configurations.certificate_locale IS 'The locale of the certificate e.g. en, fi, sv, etc. Impacts the format of the date.';
COMMENT ON COLUMN course_module_certificate_configurations.paper_size IS 'The paper size of the certificate. Available options are horizontal-a4 and vertical-a4.';
COMMENT ON COLUMN course_module_certificate_configurations.background_svg_path IS 'The path to the background svg file in the file store.';
COMMENT ON COLUMN course_module_certificate_configurations.background_svg_file_upload_id IS 'The file upload record for the background svg.';
COMMENT ON COLUMN course_module_certificate_configurations.overlay_svg_path IS 'The path to the overlay svg file in the file store. The overlay svg is rendered on top of the certificate after everything else has been rendered.';
COMMENT ON COLUMN course_module_certificate_configurations.overlay_svg_file_upload_id IS 'The file upload record for the overlay svg.';