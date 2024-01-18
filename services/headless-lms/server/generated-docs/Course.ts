type Course = {
  id: string
  slug: string
  created_at: string
  updated_at: string
  name: string
  description: string | null
  organization_id: string
  deleted_at: string | null
  language_code: string
  copied_from: string | null
  content_search_language: string | null
  course_language_group_id: string
  is_draft: boolean
  is_test_mode: boolean
  base_module_completion_requires_n_submodule_completions: number
}
