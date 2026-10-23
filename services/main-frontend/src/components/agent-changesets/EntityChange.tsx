"use client"

import { css } from "@emotion/css"
import { useRouter } from "next/navigation"
import React from "react"
import { useTranslation } from "react-i18next"

import { createAgentChangesetPreviewLinkMutation } from "@/generated/api/@tanstack/react-query.generated"
import type {
  AgentChangesetEntityOperation,
  ContentEntityType,
  EntityRef,
  PageChange,
  PreviewPage,
  PublishConflict,
  ReviewEntity,
} from "@/generated/api/types.generated"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { baseTheme, fontWeights } from "@/shared-module/common/styles"
import { dateToString } from "@/shared-module/common/utils/time"
import { Badge, Button, ErrorNotice, TONE } from "@/shared-module/components"

import BeforeAfterColumns from "./BeforeAfterColumns"
import ExerciseWarningList from "./ExerciseWarningList"
import FieldChanges from "./FieldChanges"
import RiskReasonList from "./RiskReasonList"
import StagedPageContent from "./StagedPageContent"
import { useEntityName } from "./useEntityName"

/** An entity's heading, such as "Page: Variables"; the course default review config has no name. */
export function useEntityTitle() {
  const entityTypeLabel = useEntityTypeLabel()
  const entityName = useEntityName()
  return (entity: EntityRef): string =>
    entity.entity_type === "course_default_review_config"
      ? entityTypeLabel(entity.entity_type)
      : `${entityTypeLabel(entity.entity_type)}: ${entityName(entity)}`
}

/** Names an entity type for teachers, e.g. "Page". */
export function useEntityTypeLabel() {
  const { t } = useTranslation()
  return (entityType: ContentEntityType): string => {
    switch (entityType) {
      case "page":
        return t("agent-entity-page")
      case "chapter":
        return t("agent-entity-chapter")
      case "module":
        return t("agent-entity-module")
      case "course_settings":
        return t("agent-entity-course-settings")
      case "glossary_term":
        return t("agent-entity-glossary-term")
      case "reference":
        return t("agent-entity-reference")
      case "course_default_review_config":
        return t("agent-entity-course-default-review-config")
    }
  }
}

interface EntityLabelListProps<Entity extends EntityRef> {
  entities: Entity[]
  /** Shown in parentheses after an entity's label. */
  detail?: (entity: Entity) => string | null
}

/** Entities as a list of "type: label" items. */
export function EntityLabelList<Entity extends EntityRef>({
  entities,
  detail,
}: EntityLabelListProps<Entity>) {
  const entityTitle = useEntityTitle()
  return (
    <ul>
      {entities.map((entity) => {
        const entityDetail = detail?.(entity)
        return (
          <li key={`${entity.entity_type}-${entity.entity_id}`}>
            {entityTitle(entity)}
            {entityDetail && ` (${entityDetail})`}
          </li>
        )
      })}
    </ul>
  )
}

/** Entities whose live version changed after they were staged, with when and how if known. */
export const ConflictList: React.FC<{ conflicts: PublishConflict[] }> = ({ conflicts }) => {
  const { t } = useTranslation()
  return (
    <EntityLabelList
      entities={conflicts}
      detail={(conflict) => {
        if (!conflict.last_changed_at) {
          return null
        }
        const time = dateToString(conflict.last_changed_at)
        return conflict.last_changed_via_client
          ? t("agent-conflict-changed-via", { time, client: conflict.last_changed_via_client })
          : t("agent-conflict-changed-at", { time })
      }}
    />
  )
}

const OperationBadge: React.FC<{ operation: AgentChangesetEntityOperation }> = ({ operation }) => {
  const { t } = useTranslation()
  switch (operation) {
    case "create":
      return <Badge tone={TONE.SUCCESS}>{t("agent-operation-create")}</Badge>
    case "update":
      return <Badge tone={TONE.INFO}>{t("agent-operation-update")}</Badge>
    case "delete":
      return <Badge tone={TONE.DANGER}>{t("agent-operation-delete")}</Badge>
  }
}

const stagedContent = (page: PreviewPage) => (
  <StagedPageContent page={page} isConstrainedToContainer embeddedUnderHeadingLevel={4} />
)

/** The page before and after the change, rendered as students see it, side by side. */
const PageContentChange: React.FC<{ change: PageChange }> = ({ change }) => {
  const { t } = useTranslation()
  if (!change.is_content_changed) {
    return <p>{t("agent-page-content-unchanged")}</p>
  }
  return (
    <BeforeAfterColumns
      before={change.base && stagedContent(change.base)}
      after={change.after && stagedContent(change.after)}
      data-testid-prefix="agent-page"
    />
  )
}

interface EntityChangeProps {
  reviewEntity: ReviewEntity
  changesetId: string
  isChangesetOpen: boolean
  conflicts: PublishConflict[]
}

/** One staged entity on the review page: what changes, why it matters, and whether it conflicts. */
const EntityChange: React.FC<EntityChangeProps> = ({
  reviewEntity,
  changesetId,
  isChangesetOpen,
  conflicts,
}) => {
  const { t } = useTranslation()
  const router = useRouter()
  const entityTitle = useEntityTitle()
  const entityName = useEntityName()
  const {
    entity_type: entityType,
    entity_id: entityId,
    operation,
    risk_reasons: riskReasons,
    field_changes: fieldChanges,
  } = reviewEntity
  const name = entityName(reviewEntity)
  const hasConflict = conflicts.some(
    (conflict) => conflict.entity_type === entityType && conflict.entity_id === entityId,
  )
  const headingId = `agent-entity-${entityType}-${entityId}`

  const previewLinkMutation = useToastMutationOptions(
    createAgentChangesetPreviewLinkMutation(),
    { notify: false },
    {
      onSuccess: (link) => {
        router.push(link.preview_path)
      },
    },
  )

  return (
    <article
      data-testid="agent-entity-change"
      aria-labelledby={headingId}
      className={css`
        border: 1px solid ${baseTheme.colors.gray[200]};
        border-radius: 8px;
        padding: 1.25rem;
        background: ${baseTheme.colors.gray[25]};
        display: flex;
        flex-direction: column;
        gap: 1rem;
      `}
    >
      <header
        className={css`
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.5rem;
        `}
      >
        <h3
          id={headingId}
          className={css`
            font-size: 1.125rem;
            font-weight: ${fontWeights.semibold};
            color: ${baseTheme.colors.gray[700]};
            margin: 0;
            margin-right: auto;
          `}
        >
          {entityTitle(reviewEntity)}
        </h3>
        <OperationBadge operation={operation} />
        {riskReasons.length > 0 && <Badge tone={TONE.WARNING}>{t("agent-affects-students")}</Badge>}
        {hasConflict && <Badge tone={TONE.DANGER}>{t("agent-changed-meanwhile")}</Badge>}
      </header>

      {riskReasons.length > 0 && <RiskReasonList reasons={riskReasons} />}

      {reviewEntity.kind === "page" && reviewEntity.warnings.length > 0 && (
        <ExerciseWarningList warnings={reviewEntity.warnings} />
      )}

      {hasConflict && <p>{t("agent-entity-conflict-explanation")}</p>}

      {reviewEntity.kind === "course_default_review_config" && (
        <p data-testid="agent-default-review-config-reach">
          {t("agent-default-review-config-affects-exercises", {
            count: reviewEntity.exercise_count,
          })}
        </p>
      )}

      <FieldChanges
        changes={fieldChanges}
        caption={t("agent-field-changes-caption", { label: name })}
      />

      {reviewEntity.kind === "page" && <PageContentChange change={reviewEntity} />}

      {reviewEntity.kind === "page" && reviewEntity.after && isChangesetOpen && (
        <div>
          <Button
            variant="secondary"
            size="medium"
            isLoading={previewLinkMutation.isPending}
            data-testid="agent-open-preview-button"
            onPress={() =>
              previewLinkMutation.mutate({
                path: { changeset_id: changesetId, page_id: entityId },
              })
            }
          >
            {t("agent-open-preview")}
          </Button>
          {previewLinkMutation.isError && (
            <ErrorNotice
              error={previewLinkMutation.error}
              context={t("agent-open-preview-failed")}
              headingLevel={4}
              data-testid="agent-open-preview-error"
            />
          )}
        </div>
      )}
    </article>
  )
}

// Keeps the review page's dialog and mutation state changes from re-rendering every page preview.
export default React.memo(EntityChange)
