type Vec<UserModuleCompletionStatus> = Array<{
  completed: boolean
  default: boolean
  module_id: string
  name: string
  order_number: number
  prerequisite_modules_completed: boolean
  grade: number | null
  passed: boolean | null
  enable_registering_completion_to_uh_open_university: boolean
  certification_enabled: boolean
}>
