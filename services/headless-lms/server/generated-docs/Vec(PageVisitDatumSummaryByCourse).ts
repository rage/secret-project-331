type Vec<PageVisitDatumSummaryByCourse> = Array<{
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  course_id: string | null
  exam_id: string | null
  referrer: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_term: string | null
  utm_content: string | null
  num_visitors: number
  visit_date: string
}>
