import {
  BlockProposalInfo,
  EditProposalInfo,
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

export const processProposal = async (
  pageId: string,
  pageProposalId: string,
  blockProposals: BlockProposalInfo[],
): Promise<void> => {
  const data: EditProposalInfo = {
    page_id: pageId,
    page_proposal_id: pageProposalId,
    block_proposals: blockProposals,
  }
  await mainFrontendClient.post(`/proposed-edits/process-edit-proposal`, data, {
    headers: { "Content-Type": "application/json" },
  })
}
