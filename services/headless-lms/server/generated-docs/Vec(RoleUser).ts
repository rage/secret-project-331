type Vec<RoleUser> = Array<{
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  role: UserRole
}>
