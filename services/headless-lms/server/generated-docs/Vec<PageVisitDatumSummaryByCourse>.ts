type Vec<PageVisitDatumSummaryByCourse> = Array<{
  id: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
  course_id: string | null
  exam_id: string | null
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
