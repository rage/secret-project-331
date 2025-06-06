ALTER TABLE certificate_configurations
ADD COLUMN render_certificate_grade BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN certificate_grade_y_pos VARCHAR(255),
  ADD COLUMN certificate_grade_x_pos VARCHAR(255),
  ADD COLUMN certificate_grade_font_size VARCHAR(255),
  ADD COLUMN certificate_grade_text_color VARCHAR(255),
  ADD COLUMN certificate_grade_text_anchor certificate_text_anchor;

COMMENT ON COLUMN certificate_configurations.render_certificate_grade IS 'Whether to render grade on certificate or not';
COMMENT ON COLUMN certificate_configurations.certificate_grade_y_pos IS 'Optional. The y position of the grade text.';
COMMENT ON COLUMN certificate_configurations.certificate_grade_x_pos IS 'Optional. The x position of the grade text.';
COMMENT ON COLUMN certificate_configurations.certificate_grade_font_size IS 'Optional. The font size of the grade text.';
COMMENT ON COLUMN certificate_configurations.certificate_grade_text_color IS 'Optional. The color of the grade text.';
COMMENT ON COLUMN certificate_configurations.certificate_grade_text_anchor IS 'Optional. How the grade text should be aligned relative to the given x and y positions. See https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/text-anchor.';
