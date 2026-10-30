"use client"

import { css } from "@emotion/css"
import { useQueryClient } from "@tanstack/react-query"
import React, { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  discardAgentChangesetMutation,
  getAgentChangesetCountsQueryKey,
  getAgentChangesetQueryKey,
  getAgentChangesetsQueryKey,
  publishAgentChangesetMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import type {
  ChangesetReview as ChangesetReviewData,
  DiscardRejection,
  PublishOutcome,
} from "@/generated/api/types.generated"
import { showSuccessNotification } from "@/shared-module/common/components/Notifications/notificationHelpers"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { baseTheme, fontWeights } from "@/shared-module/common/styles"
import { dateToString } from "@/shared-module/common/utils/time"
import { Button, ConfirmDialog, ErrorNotice, Infobox, TONE } from "@/shared-module/components"

import AgentCallList from "./AgentCallList"
import { STICKY_TOP_PROPERTY } from "./BeforeAfterTabs"
import { ChangesetStatusBadge } from "./ChangesetStatusBadge"
import EntityChange, {
  ChapterFrontPageIdsContext,
  ConflictList,
  EntityLabelList,
} from "./EntityChange"
import PublishOutcomeNotice, { RejectionNotice } from "./PublishOutcomeNotice"
import { sortReviewEntities } from "./sortReviewEntities"

const sectionHeadingCss = css`
  font-size: 1.25rem;
  font-weight: ${fontWeights.semibold};
  color: ${baseTheme.colors.gray[700]};
  margin: 0;
`

interface ChangesetReviewProps {
  review: ChangesetReviewData
}

/** The review page body: what the agent changed, what it means for students, publish or discard. */
const ChangesetReview: React.FC<ChangesetReviewProps> = ({ review }) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false)
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false)
  const [publishOutcome, setPublishOutcome] = useState<PublishOutcome | null>(null)
  const [discardRejection, setDiscardRejection] = useState<DiscardRejection | null>(null)
  const { changeset, entities, calls, conflicts } = review
  const isOpen = changeset.status === "open"
  const riskyEntityCount = entities.filter((e) => e.risk_reasons.length > 0).length
  const clientNames = [...new Set(calls.map((call) => call.client_name))]
  const chapterFrontPageIds = useMemo(
    () => new Set(review.chapter_front_page_ids),
    [review.chapter_front_page_ids],
  )
  const sortedEntities = useMemo(
    () => sortReviewEntities(entities, chapterFrontPageIds),
    [entities, chapterFrontPageIds],
  )

  // The global `overflow-x: hidden` on body makes it a scroll container that never scrolls,
  // which pins the sticky action bar to it instead of the viewport.
  useEffect(() => {
    const previous = document.body.style.overflowX
    // oxlint-disable-next-line i18next/no-literal-string
    document.body.style.overflowX = "visible"
    return () => {
      document.body.style.overflowX = previous
    }
  }, [])

  const reviewRef = useRef<HTMLDivElement>(null)
  const actionBarRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const reviewElement = reviewRef.current
    const actionBar = actionBarRef.current
    if (reviewElement === null || actionBar === null) {
      return
    }
    const observer = new ResizeObserver(() => {
      reviewElement.style.setProperty(STICKY_TOP_PROPERTY, `${actionBar.offsetHeight}px`)
    })
    observer.observe(actionBar)
    return () => {
      observer.disconnect()
      reviewElement.style.removeProperty(STICKY_TOP_PROPERTY)
    }
  }, [isOpen])

  const invalidateChangesets = async () => {
    await queryClient.invalidateQueries({
      queryKey: getAgentChangesetQueryKey({ path: { changeset_id: changeset.id } }),
    })
    await queryClient.invalidateQueries({
      queryKey: getAgentChangesetsQueryKey({ query: { course_id: changeset.course_id } }),
    })
    await queryClient.invalidateQueries({
      queryKey: getAgentChangesetCountsQueryKey({ query: { course_id: changeset.course_id } }),
    })
  }

  const publishMutation = useToastMutationOptions(
    publishAgentChangesetMutation(),
    { notify: false },
    {
      onSuccess: async (outcome) => {
        setPublishOutcome(outcome)
        setDiscardRejection(null)
        setIsPublishDialogOpen(false)
        await invalidateChangesets()
      },
      // The changeset may have expired or been discarded meanwhile; show its current status.
      onError: async () => {
        await invalidateChangesets()
      },
    },
  )
  const discardMutation = useToastMutationOptions(
    discardAgentChangesetMutation(),
    { notify: false },
    {
      onSuccess: async (outcome) => {
        setIsDiscardDialogOpen(false)
        setPublishOutcome(null)
        if (outcome.outcome === "discarded") {
          setDiscardRejection(null)
          showSuccessNotification({ message: t("agent-discarded-message") })
        } else {
          setDiscardRejection(outcome.rejection)
        }
        await invalidateChangesets()
      },
    },
  )

  return (
    <ChapterFrontPageIdsContext.Provider value={chapterFrontPageIds}>
      <div
        ref={reviewRef}
        data-testid="agent-changeset-review"
        className={css`
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        `}
      >
        <div
          className={css`
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          `}
        >
          <div
            className={css`
              display: flex;
              flex-wrap: wrap;
              align-items: center;
              gap: 0.75rem;
            `}
          >
            <h2 className={sectionHeadingCss}>{t("agent-changeset-review-title")}</h2>
            <ChangesetStatusBadge status={changeset.status} />
          </div>
          <p
            className={css`
              margin: 0;
              color: ${baseTheme.colors.gray[600]};
            `}
          >
            {t("agent-changeset-summary", {
              count: entities.length,
              clients: clientNames.join(", "),
              time: dateToString(changeset.updated_at),
            })}
          </p>
        </div>

        {publishOutcome && <PublishOutcomeNotice outcome={publishOutcome} />}

        {discardRejection && (
          <RejectionNotice
            heading={t("agent-not-discarded-heading")}
            rejection={discardRejection}
            data-testid="agent-discard-outcome"
          />
        )}

        {isOpen && review.is_expiring_soon && (
          <Infobox
            tone={TONE.WARNING}
            heading={t("agent-expiry-heading", { time: dateToString(changeset.expires_at) })}
            data-testid="agent-expiry-warning"
          >
            <p>{t("agent-expiry-description")}</p>
            <EntityLabelList entities={entities} />
          </Infobox>
        )}

        {isOpen && conflicts.length > 0 && (
          <Infobox
            tone={TONE.DANGER}
            heading={t("agent-conflicts-heading")}
            data-testid="agent-conflicts"
          >
            <p>{t("agent-conflicts-description")}</p>
            <ConflictList conflicts={conflicts} />
          </Infobox>
        )}

        {isOpen && riskyEntityCount > 0 && (
          <Infobox
            tone={TONE.WARNING}
            heading={t("agent-risky-heading", { count: riskyEntityCount })}
          >
            <p>{t("agent-risky-description")}</p>
          </Infobox>
        )}

        {isOpen && (
          <div
            ref={actionBarRef}
            className={css`
              position: sticky;
              top: 0;
              z-index: 10;
              display: flex;
              flex-wrap: wrap;
              gap: 0.75rem;
              padding: 0.75rem 0;
              background: ${baseTheme.colors.clear[100]};
              border-bottom: 1px solid ${baseTheme.colors.gray[100]};
            `}
          >
            <Button
              variant="primary"
              size="medium"
              data-testid="agent-publish-button"
              disabled={conflicts.length > 0 || entities.length === 0}
              onPress={() => setIsPublishDialogOpen(true)}
            >
              {t("agent-publish-changes")}
            </Button>
            <Button
              variant="tertiary"
              size="medium"
              data-testid="agent-discard-button"
              onPress={() => setIsDiscardDialogOpen(true)}
            >
              {t("agent-discard-changes")}
            </Button>
          </div>
        )}

        <section
          aria-labelledby="agent-changes-heading"
          className={css`
            display: flex;
            flex-direction: column;
            gap: 1rem;
          `}
        >
          <h2 id="agent-changes-heading" className={sectionHeadingCss}>
            {t("agent-changes-heading")}
          </h2>
          {entities.length === 0 ? (
            <p>{t("agent-no-changes")}</p>
          ) : (
            sortedEntities.map((reviewEntity) => (
              <EntityChange
                key={`${reviewEntity.entity_type}-${reviewEntity.entity_id}`}
                reviewEntity={reviewEntity}
                changesetId={changeset.id}
                isChangesetOpen={isOpen}
                conflicts={conflicts}
              />
            ))
          )}
        </section>

        {calls.length > 0 && <AgentCallList calls={calls} />}

        <ConfirmDialog
          open={isPublishDialogOpen}
          onClose={() => {
            setIsPublishDialogOpen(false)
            publishMutation.reset()
          }}
          title={t("agent-publish-dialog-title")}
          description={
            <>
              <p>{t("agent-publish-dialog-description", { count: entities.length })}</p>
              {riskyEntityCount > 0 && (
                <p>{t("agent-publish-dialog-risky", { count: riskyEntityCount })}</p>
              )}
              {publishMutation.isError && (
                <ErrorNotice
                  error={publishMutation.error}
                  context={t("agent-publish-failed")}
                  headingLevel={3}
                  data-testid="agent-publish-error"
                />
              )}
            </>
          }
          confirmLabel={t("agent-publish-changes")}
          // oxlint-disable-next-line i18next/no-literal-string
          confirmTestId="agent-publish-confirm-button"
          onConfirm={async () => {
            try {
              await publishMutation.mutateAsync({
                path: { changeset_id: changeset.id },
                body: { reviewed_revision: changeset.revision },
              })
            } catch {
              // Shown in the dialog from publishMutation.error.
            }
          }}
        />
        <ConfirmDialog
          open={isDiscardDialogOpen}
          onClose={() => {
            setIsDiscardDialogOpen(false)
            discardMutation.reset()
          }}
          title={t("agent-discard-dialog-title")}
          description={
            <>
              <p>{t("agent-discard-dialog-description", { count: entities.length })}</p>
              {discardMutation.isError && (
                <ErrorNotice
                  error={discardMutation.error}
                  context={t("agent-discard-failed")}
                  headingLevel={3}
                  data-testid="agent-discard-error"
                />
              )}
            </>
          }
          confirmLabel={t("agent-discard-changes")}
          // oxlint-disable-next-line i18next/no-literal-string
          confirmTestId="agent-discard-confirm-button"
          isDestructive
          onConfirm={async () => {
            try {
              await discardMutation.mutateAsync({
                path: { changeset_id: changeset.id },
                body: { reviewed_revision: changeset.revision },
              })
            } catch {
              // Shown in the dialog from discardMutation.error.
            }
          }}
        />
      </div>
    </ChapterFrontPageIdsContext.Provider>
  )
}

export default ChangesetReview
