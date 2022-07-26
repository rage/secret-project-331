type Vec<UserModuleCompletionStatus> = Array<{
  completed: boolean
  default: boolean
  module_id: string
  name: string
  order_number: number
  prerequisite_modules_completed: boolean
}>
