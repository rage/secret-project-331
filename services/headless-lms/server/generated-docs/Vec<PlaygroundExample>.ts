type Vec<PlaygroundExample> = Array<{
  id: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
  name: string
  url: string
  width: number
  data: unknown
}>
