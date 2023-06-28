type Vec<PageVisitDatumSummaryByPages> = Array<{
  id: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
  exam_id: string | null
  course_id: string | null
  page_id: string
  country: string | null
  device_type: string | null
  referrer: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_term: string | null
  utm_content: string | null
  num_visitors: number
  visit_date: Date
}>
