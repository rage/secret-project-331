type Vec<PageVisitDatumSummaryByCoursesCountries> = Array<{
  id: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
  country: string | null
  course_id: string | null
  exam_id: string | null
  num_visitors: number
  visit_date: Date
}>
