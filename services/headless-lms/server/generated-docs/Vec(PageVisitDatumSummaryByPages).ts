type Vec<PageVisitDatumSummaryByPages> = Array<{
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  exam_id: string | null
  course_id: string | null
  page_id: string
  num_visitors: number
  visit_date: string
}>
