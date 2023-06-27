type Vec<PageVisitDatumSummaryByCourseDeviceTypes> = Array<{
  id: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
  country: string | null
  browser: string | null
  browser_version: string | null
  operating_system: string | null
  operating_system_version: string | null
  device_type: string | null
  course_id: string | null
  exam_id: string | null
  num_visitors: number
  visit_date: Date
}>
