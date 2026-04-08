import { queryOptions } from "@tanstack/react-query"

import {
  getEditProposalCountOptions as getEditProposalCountGeneratedOptions,
  getEditProposalsOptions as getEditProposalsGeneratedOptions,
  processEditProposalMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import {
  getEditProposalCount as getEditProposalCountFromApi,
  getEditProposals as getEditProposalsFromApi,
  processEditProposal as processEditProposalFromApi,
} from "@/generated/api/sdk.generated"
import type {
  BlockProposal as GeneratedBlockProposal,
  PageProposal as GeneratedPageProposal,
} from "@/generated/api/types.generated"
import {
  BlockProposalInfo,
  EditProposalInfo,
  GetEditProposalsQuery,
  PageProposal,
  ProposalCount,
} from "@/shared-module/common/bindings"

const normalizeBlockProposal = (blockProposal: GeneratedBlockProposal) => {
  if (blockProposal.type === "edited-block-still-exists") {
    return {
      ...blockProposal,
      accept_preview: blockProposal.accept_preview ?? null,
    }
  }

  return blockProposal
}

const normalizePageProposal = (pageProposal: GeneratedPageProposal): PageProposal => ({
  ...pageProposal,
  user_id: pageProposal.user_id ?? null,
  block_proposals: pageProposal.block_proposals.map(normalizeBlockProposal),
})

export const fetchEditProposals = async (
  courseId: string,
  pending: boolean,
  page?: number,
  limit?: number,
): Promise<PageProposal[]> => {
  const query: GetEditProposalsQuery = { page, limit, pending }

  const proposals = await getEditProposalsFromApi({
    path: {
      course_id: courseId,
    },
    query,
    throwOnError: true,
  })

  return proposals.map(normalizePageProposal)
}

export const fetchEditProposalCount = async (courseId: string): Promise<ProposalCount> => {
  return await getEditProposalCountFromApi({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })
}

export const getEditProposalsOptions = (
  courseId: string,
  pending: boolean,
  page?: number,
  limit?: number,
) => {
  const query: GetEditProposalsQuery = { page, limit, pending }

  return queryOptions({
    ...getEditProposalsGeneratedOptions({
      path: {
        course_id: courseId,
      },
      query,
    }),
    select: (proposals): PageProposal[] => proposals.map(normalizePageProposal),
  })
}

export const getEditProposalCountOptions = (courseId: string) =>
  queryOptions({
    ...getEditProposalCountGeneratedOptions({
      path: {
        course_id: courseId,
      },
    }),
  })

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

  await processEditProposalFromApi({
    body: data,
    throwOnError: true,
  })
}

export const processProposalMutationOptions = () => processEditProposalMutation()
