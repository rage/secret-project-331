import { PageProposal, ProposalCount } from "../../shared-module/bindings"
import { mainFrontendClient } from "../mainFrontendClient"

export const fetchEditProposals = async (
  courseId: string,
  page?: number,
  limit?: number,
): Promise<PageProposal[]> => {
  const response = await mainFrontendClient.get(`/courses/${courseId}/edit-proposals`, {
    params: { page, limit },
    responseType: "json",
  })
  return response.data
}

export const fetchEditProposalCount = async (courseId: string): Promise<ProposalCount> => {
  const response = await mainFrontendClient.get(`/courses/${courseId}/edit-proposal-count`)
  return response.data
}
