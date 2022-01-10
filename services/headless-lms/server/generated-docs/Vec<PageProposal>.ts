type Vec<PageProposal> = Array<{
  id: string
  page_id: string
  user_id: string | null
  pending: boolean
  created_at: Date
  block_proposals: Array<BlockProposal>
}>
