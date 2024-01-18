type Vec<PageProposal> = Array<{
  id: string
  page_id: string
  user_id: string | null
  pending: boolean
  created_at: string
  block_proposals: Array<BlockProposal>
  page_title: string
  page_url_path: string
}>
