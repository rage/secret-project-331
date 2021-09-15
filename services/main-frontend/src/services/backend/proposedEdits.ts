import {
  BlockProposalInfo,
  GetEditProposalsQuery,
  PageProposal,
  ProposalCount,
} from "../../shared-module/bindings"
import { mainFrontendClient } from "../mainFrontendClient"

export const fetchEditProposals = async (
  courseId: string,
  pending: boolean,
  page?: number,
  limit?: number,
): Promise<PageProposal[]> => {
  const params: GetEditProposalsQuery = { page, limit, pending }
  const response = await mainFrontendClient.get(`/proposed-edits/course/${courseId}`, {
    params,
    responseType: "json",
  })
  return response.data
}

export const fetchEditProposalCount = async (courseId: string): Promise<ProposalCount> => {
  const response = await mainFrontendClient.get(`/proposed-edits/course/${courseId}/count`)
  return response.data
}

export const acceptEditProposalBlocks = async (
  pageId: string,
  pageProposalId: string,
  blockProposalIds: string[],
): Promise<void> => {
  const data: BlockProposalInfo = {
    page_id: pageId,
    page_proposal_id: pageProposalId,
    block_proposal_ids: blockProposalIds,
  }
  await mainFrontendClient.post(`/proposed-edits/accept-block-proposals`, data, {
    headers: { "Content-Type": "application/json" },
  })
}

export const rejectEditProposalBlocks = async (
  pageId: string,
  pageProposalId: string,
  blockProposalIds: string[],
): Promise<void> => {
  const data: BlockProposalInfo = {
    page_id: pageId,
    page_proposal_id: pageProposalId,
    block_proposal_ids: blockProposalIds,
  }
  await mainFrontendClient.post(`/proposed-edits/reject-block-proposals`, data, {
    headers: { "Content-Type": "application/json" },
  })
}
