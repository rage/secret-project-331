type Vec<UserDetail> = Array<{
  user_id: string
  created_at: Date
  updated_at: Date
  email: string
  first_name: string | null
  last_name: string | null
  search_helper: string | null
}>
