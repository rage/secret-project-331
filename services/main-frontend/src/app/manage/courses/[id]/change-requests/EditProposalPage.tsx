"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import {
  getEditProposalsOptions,
  processEditProposalMutation as processProposalMutationOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import type { BlockProposalInfo } from "@/generated/api/types.generated"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { fontWeights, typography } from "@/shared-module/common/styles/typography"
import { QueryResult } from "@/shared-module/components"

import EditProposalView from "./EditProposalView"

interface Props {
  courseId: string
  page: number
  limit: number
  pending: boolean
  onChange: () => Promise<unknown>
}

const EditProposalPage: React.FC<React.PropsWithChildren<Props>> = ({
  courseId,
  page,
  limit,
  pending,
  onChange,
}) => {
  const { t } = useTranslation()
  const getEditProposalList = useQuery({
    ...getEditProposalsOptions({
      path: {
        course_id: courseId,
      },
      query: {
        page,
        limit,
        pending,
      },
    }),
  })
  const processProposalMutation = useToastMutationOptions(processProposalMutationOptions(), {
    notify: true,
    method: "POST",
  })

  async function handleProposal(
    pageId: string,
    pageProposalId: string,
    blockProposals: BlockProposalInfo[],
  ) {
    await processProposalMutation.mutateAsync({
      body: {
        page_id: pageId,
        page_proposal_id: pageProposalId,
        block_proposals: blockProposals,
      },
    })
    await getEditProposalList.refetch()
    await onChange()
  }

  return (
    <QueryResult query={getEditProposalList} emptyFallback={<div>{t("nothing-here")}</div>}>
      {(data) => {
        const proposalsForDeletedBlocks = data.filter(
          (p) => p.block_proposals[0]?.type === "edited-block-no-longer-exists",
        )

        const editProposalList = data.filter(
          (p) => p.block_proposals[0]?.type === "edited-block-still-exists",
        )

        return (
          <>
            <ul
              className={css`
                list-style: none;
                padding: 0;
              `}
            >
              {editProposalList &&
                editProposalList.map((p) => (
                  <li key={p.id}>
                    <EditProposalView proposal={p} handleProposal={handleProposal} />
                  </li>
                ))}
            </ul>

            {proposalsForDeletedBlocks?.length !== 0 && (
              <>
                {pending === true && (
                  <h5
                    className={css`
                      font-size: ${typography.h5};
                      font-weight: ${fontWeights.semibold};
                    `}
                  >
                    {t("change-request-for-deleted-block")}
                  </h5>
                )}

                <ul
                  className={css`
                    list-style: none;
                    padding: 0;
                  `}
                >
                  {proposalsForDeletedBlocks?.map((p) => (
                    <li key={p.id}>
                      <EditProposalView proposal={p} handleProposal={handleProposal} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )
      }}
    </QueryResult>
  )
}

export default EditProposalPage
