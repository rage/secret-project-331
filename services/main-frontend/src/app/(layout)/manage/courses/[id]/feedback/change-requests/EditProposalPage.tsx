"use client"

import { css } from "@emotion/css"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { VisuallyHidden } from "react-aria"
import { useTranslation } from "react-i18next"

import {
  getCourseFeedbackCountQueryKey,
  getEditProposalsOptions,
  processEditProposalMutation as processProposalMutationOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import type { BlockProposalInfo } from "@/generated/api/types.generated"
import { useUserNames } from "@/hooks/useUserDetails"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { fontWeights, typography } from "@/shared-module/common/styles/typography"
import { QueryResult, useFocusAfterRemoval } from "@/shared-module/components"

import EditProposalView, { changeRequestHeadingId } from "./EditProposalView"

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
  const queryClient = useQueryClient()
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
  const { containerRef, listHeadingRef, remember } = useFocusAfterRemoval(getEditProposalList.data)
  const senderName = useUserNames(
    courseId,
    getEditProposalList.data?.map((p) => p.user_id),
  )
  const processProposalMutation = useToastMutationOptions(
    processProposalMutationOptions(),
    {
      notify: true,
      method: "POST",
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getCourseFeedbackCountQueryKey({ path: { course_id: courseId } }),
        })
      },
    },
  )

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
    remember(changeRequestHeadingId(pageProposalId))
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
          <div ref={containerRef}>
            <VisuallyHidden>
              <h2 ref={listHeadingRef} tabIndex={-1}>
                {t("link-change-requests")}
              </h2>
            </VisuallyHidden>
            <ul
              className={css`
                list-style: none;
                padding: 0;
              `}
            >
              {editProposalList &&
                editProposalList.map((p) => (
                  <li key={p.id}>
                    <EditProposalView
                      proposal={p}
                      senderName={senderName(p.user_id)}
                      handleProposal={handleProposal}
                    />
                  </li>
                ))}
            </ul>

            {proposalsForDeletedBlocks?.length !== 0 && (
              <>
                {pending === true && (
                  <h2
                    className={css`
                      font-size: ${typography.h5};
                      font-weight: ${fontWeights.semibold};
                    `}
                  >
                    {t("change-request-for-deleted-block")}
                  </h2>
                )}

                <ul
                  className={css`
                    list-style: none;
                    padding: 0;
                  `}
                >
                  {proposalsForDeletedBlocks?.map((p) => (
                    <li key={p.id}>
                      <EditProposalView
                        proposal={p}
                        senderName={senderName(p.user_id)}
                        handleProposal={handleProposal}
                      />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )
      }}
    </QueryResult>
  )
}

export default EditProposalPage
