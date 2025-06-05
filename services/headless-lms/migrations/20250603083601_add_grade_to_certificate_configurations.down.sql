ALTER TABLE certificate_configurations DROP COLUMN certificate_grade_y_pos,
  DROP COLUMN certificate_grade_x_pos,
  DROP COLUMN certificate_grade_font_size,
  DROP COLUMN certificate_grade_text_color,
  DROP COLUMN certificate_grade_text_anchor;


ALTER TABLE generated_certificates DROP COLUMN grade;
