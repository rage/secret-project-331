type Vec<Organization> = Array<{
  id: string
  slug: string
  created_at: Date
  updated_at: Date
  name: string
  description: string | null
  organization_image_url: string | null
  deleted_at: Date | null
}>
