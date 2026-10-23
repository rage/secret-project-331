"use client"

import { css } from "@emotion/css"
import { useQueryClient } from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import {
  discardAgentChangesetMutation,
  getAgentChangesetQueryKey,
  getAgentChangesetsQueryKey,
  publishAgentChangesetMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import type {
  AgentChangesetStatus,
  ChangesetReview as ChangesetReviewData,
  PublishOutcome,
} from "@/generated/api/types.generated"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { baseTheme, fontWeights } from "@/shared-module/common/styles"
import { dateToString } from "@/shared-module/common/utils/time"
import { Badge, Button, ConfirmDialog, Infobox, TONE } from "@/shared-module/components"

import AgentCallList from "./AgentCallList"
import EntityChange, { useEntityTypeLabel } from "./EntityChange"
import PublishOutcomeNotice from "./PublishOutcomeNotice"

/** A changeset's status in words a teacher reads. */
export const ChangesetStatusBadge: React.FC<{ status: AgentChangesetStatus }> = ({ status }) => {
  const { t } = useTranslation()
  switch (status) {
    case "open":
      return <Badge tone={TONE.INFO}>{t("agent-changeset-status-open")}</Badge>
    case "published":
      return <Badge tone={TONE.SUCCESS}>{t("agent-changeset-status-published")}</Badge>
    case "discarded":
      return <Badge tone={TONE.NEUTRAL}>{t("agent-changeset-status-discarded")}</Badge>
    case "expired":
      return <Badge tone={TONE.NEUTRAL}>{t("agent-changeset-status-expired")}</Badge>
  }
}

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
  const entityTypeLabel = useEntityTypeLabel()
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false)
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false)
  const [publishOutcome, setPublishOutcome] = useState<PublishOutcome | null>(null)
  const { changeset, entities, calls, conflicts } = review
  const isOpen = changeset.status === "open"
  const riskyEntityCount = entities.filter((e) => e.entity.risk_reasons.length > 0).length
  const clientNames = [...new Set(calls.map((call) => call.client_name))]

  const invalidateChangesets = async () => {
    await queryClient.invalidateQueries({
      queryKey: getAgentChangesetQueryKey({ path: { changeset_id: changeset.id } }),
    })
    await queryClient.invalidateQueries({
      queryKey: getAgentChangesetsQueryKey({ query: { course_id: changeset.course_id } }),
    })
  }

  const publishMutation = useToastMutationOptions(
    publishAgentChangesetMutation(),
    { notify: false },
    {
      onSuccess: async (outcome) => {
        setPublishOutcome(outcome)
        setIsPublishDialogOpen(false)
        await invalidateChangesets()
      },
    },
  )
  const discardMutation = useToastMutationOptions(
    discardAgentChangesetMutation(),
    {
      notify: true,
      method: "POST",
      successMessage: t("agent-discarded-message"),
    },
    {
      onSuccess: async () => {
        setIsDiscardDialogOpen(false)
        await invalidateChangesets()
      },
    },
  )

  return (
    <div
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

      {isOpen && review.is_expiring_soon && (
        <Infobox
          tone={TONE.WARNING}
          heading={t("agent-expiry-heading", { time: dateToString(changeset.expires_at) })}
          data-testid="agent-expiry-warning"
        >
          <p>{t("agent-expiry-description")}</p>
          <ul>
            {entities.map((e) => (
              <li key={e.entity.id}>
                {entityTypeLabel(e.entity.entity_type)}: {e.label}
              </li>
            ))}
          </ul>
        </Infobox>
      )}

      {isOpen && conflicts.length > 0 && (
        <Infobox
          tone={TONE.DANGER}
          heading={t("agent-conflicts-heading")}
          data-testid="agent-conflicts"
        >
          <p>{t("agent-conflicts-description")}</p>
          <ul>
            {conflicts.map((conflict) => (
              <li key={`${conflict.entity_type}-${conflict.entity_id}`}>
                {entityTypeLabel(conflict.entity_type)}: {conflict.label}
                {conflict.last_changed_at &&
                  ` (${
                    conflict.last_changed_via_client
                      ? t("agent-conflict-changed-via", {
                          time: dateToString(conflict.last_changed_at),
                          client: conflict.last_changed_via_client,
                        })
                      : t("agent-conflict-changed-at", {
                          time: dateToString(conflict.last_changed_at),
                        })
                  })`}
              </li>
            ))}
          </ul>
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
          className={css`
            display: flex;
            flex-wrap: wrap;
            gap: 0.75rem;
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
          entities.map((reviewEntity) => (
            <EntityChange
              key={reviewEntity.entity.id}
              reviewEntity={reviewEntity}
              isChangesetOpen={isOpen}
            />
          ))
        )}
      </section>

      {calls.length > 0 && <AgentCallList calls={calls} />}

      <ConfirmDialog
        open={isPublishDialogOpen}
        onClose={() => setIsPublishDialogOpen(false)}
        title={t("agent-publish-dialog-title")}
        description={
          <>
            <p>{t("agent-publish-dialog-description", { count: entities.length })}</p>
            {riskyEntityCount > 0 && (
              <p>{t("agent-publish-dialog-risky", { count: riskyEntityCount })}</p>
            )}
          </>
        }
        confirmLabel={t("agent-publish-changes")}
        // oxlint-disable-next-line i18next/no-literal-string
        confirmTestId="agent-publish-confirm-button"
        onConfirm={async () => {
          await publishMutation.mutateAsync({ path: { changeset_id: changeset.id } })
        }}
      />
      <ConfirmDialog
        open={isDiscardDialogOpen}
        onClose={() => setIsDiscardDialogOpen(false)}
        title={t("agent-discard-dialog-title")}
        description={t("agent-discard-dialog-description", { count: entities.length })}
        confirmLabel={t("agent-discard-changes")}
        // oxlint-disable-next-line i18next/no-literal-string
        confirmTestId="agent-discard-confirm-button"
        isDestructive
        onConfirm={async () => {
          await discardMutation.mutateAsync({ path: { changeset_id: changeset.id } })
        }}
      />
    </div>
  )
}

export default ChangesetReview
