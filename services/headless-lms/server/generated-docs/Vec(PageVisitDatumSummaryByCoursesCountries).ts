type Vec<PageVisitDatumSummaryByCoursesCountries> = Array<{
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  country: string | null
  course_id: string | null
  exam_id: string | null
  num_visitors: number
  visit_date: string
}>
