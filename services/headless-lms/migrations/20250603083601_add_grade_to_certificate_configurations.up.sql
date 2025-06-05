ALTER TABLE certificate_configurations
ADD COLUMN certificate_grade_y_pos VARCHAR(255),
  ADD COLUMN certificate_grade_x_pos VARCHAR(255),
  ADD COLUMN certificate_grade_font_size VARCHAR(255),
  ADD COLUMN certificate_grade_text_color VARCHAR(255),
  ADD COLUMN certificate_grade_text_anchor certificate_text_anchor;

COMMENT ON COLUMN certificate_configurations.certificate_grade_y_pos IS 'Optional. The y position of the grade text.';
COMMENT ON COLUMN certificate_configurations.certificate_grade_x_pos IS 'Optional. The x position of the grade text.';
COMMENT ON COLUMN certificate_configurations.certificate_grade_font_size IS 'Optional. The font size of the grade text.';
COMMENT ON COLUMN certificate_configurations.certificate_grade_text_color IS 'Optional. The color of the grade text.';
COMMENT ON COLUMN certificate_configurations.certificate_grade_text_anchor IS 'Optional. How the grade text should be aligned relative to the given x and y positions. See https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/text-anchor.';


ALTER TABLE generated_certificates
ADD COLUMN grade TEXT;

COMMENT ON COLUMN generated_certificates.grade IS 'Optional grade shown on the certificate. Can be "pass", "fail", or 0-5 depending on course settings.';
