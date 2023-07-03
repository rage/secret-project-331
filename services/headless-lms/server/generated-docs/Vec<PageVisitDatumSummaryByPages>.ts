type Vec<PageVisitDatumSummaryByPages> = Array<{
  id: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
  exam_id: string | null
  course_id: string | null
  page_id: string
  num_visitors: number
  visit_date: string
}>
