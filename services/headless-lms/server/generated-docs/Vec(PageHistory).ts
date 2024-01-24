type Vec<PageHistory> = Array<{
  id: string
  created_at: string
  title: string
  content: unknown
  history_change_reason: HistoryChangeReason
  restored_from_id: string | null
  author_user_id: string
}>
