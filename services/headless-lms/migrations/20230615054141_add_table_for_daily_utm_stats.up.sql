CREATE TABLE page_view_daily_utm_stats (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  utm_source VARCHAR(255),
  utm_medium VARCHAR(255),
  utm_campaign VARCHAR(255),
  utm_term VARCHAR(255),
  utm_content VARCHAR(255),
  page_id UUID NOT NULL REFERENCES pages(id),
  course_id UUID NOT NULL REFERENCES courses(id),
  num_visitors INTEGER NOT NULL DEFAULT 0,
  visit_date DATE NOT NULL
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON page_view_daily_utm_stats FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE page_view_daily_utm_stats IS 'Holds an aggregate of page view stats for a given page and utm parameters for a given day.';
COMMENT ON COLUMN page_view_daily_utm_stats.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN page_view_daily_utm_stats.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN page_view_daily_utm_stats.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN page_view_daily_utm_stats.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN page_view_daily_utm_stats.utm_source IS 'The site that sent the traffic like google or facebook';
COMMENT ON COLUMN page_view_daily_utm_stats.utm_medium IS 'The type of traffic, such as email or cost-per-click (cpc)';
COMMENT ON COLUMN page_view_daily_utm_stats.utm_campaign IS 'The campaign name';
COMMENT ON COLUMN page_view_daily_utm_stats.utm_term IS 'The search terms';
COMMENT ON COLUMN page_view_daily_utm_stats.utm_content IS 'Identifies what was clicked';
COMMENT ON COLUMN page_view_daily_utm_stats.page_id IS 'The page that was visited';
COMMENT ON COLUMN page_view_daily_utm_stats.course_id IS 'The course that the page belongs to';
COMMENT ON COLUMN page_view_daily_utm_stats.num_visitors IS 'The number of visitors that visited the page with the given utm parameters';
COMMENT ON COLUMN page_view_daily_utm_stats.visit_date IS 'The date that the page was visited';
---
CREATE TABLE page_view_daily_referrer_stats (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  referrer VARCHAR(255),
  page_id UUID NOT NULL REFERENCES pages(id),
  course_id UUID NOT NULL REFERENCES courses(id),
  num_visitors INTEGER NOT NULL DEFAULT 0,
  visit_date DATE NOT NULL
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON page_view_daily_referrer_stats FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE page_view_daily_referrer_stats IS 'Holds an aggregate of page view stats for a given page and referrer for a given day. Can be also used to count all visitors to a page if you sum visits from all referrers (including null).';
COMMENT ON COLUMN page_view_daily_referrer_stats.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN page_view_daily_referrer_stats.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN page_view_daily_referrer_stats.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN page_view_daily_referrer_stats.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN page_view_daily_referrer_stats.referrer IS 'Url to to the site that linked to the page. If a user visited this page without a referrer, this field will be null.';
COMMENT ON COLUMN page_view_daily_referrer_stats.page_id IS 'The page that was visited';
COMMENT ON COLUMN page_view_daily_referrer_stats.course_id IS 'The course that the page belongs to';
COMMENT ON COLUMN page_view_daily_referrer_stats.num_visitors IS 'The number of visitors that visited the page with the given referrer';
COMMENT ON COLUMN page_view_daily_referrer_stats.visit_date IS 'The date that the page was visited';
