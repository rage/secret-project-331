"use client"

import { css } from "@emotion/css"
import { useRouter } from "next/navigation"
import React from "react"
import { useTranslation } from "react-i18next"

import { createAgentChangesetPreviewLinkMutation } from "@/generated/api/@tanstack/react-query.generated"
import type {
  AgentChangesetEntityOperation,
  AgentChangesetEntityType,
  PageSnapshot,
  ReviewEntity,
} from "@/generated/api/types.generated"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { baseTheme, fontWeights } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { Badge, Button, TONE } from "@/shared-module/components"

import FieldChanges from "./FieldChanges"
import RiskReasonList from "./RiskReasonList"
import StagedPageContent from "./StagedPageContent"

/** Names an entity type for teachers, e.g. "Page". */
export function useEntityTypeLabel() {
  const { t } = useTranslation()
  return (entityType: AgentChangesetEntityType): string => {
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
    }
  }
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

const columnHeadingCss = css`
  font-size: 0.875rem;
  font-weight: ${fontWeights.semibold};
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: ${baseTheme.colors.gray[500]};
  margin: 0 0 0.5rem 0;
`

const pageColumnCss = css`
  min-width: 0;
  border: 1px solid ${baseTheme.colors.gray[100]};
  border-radius: 8px;
  padding: 1rem;
  background: white;
  overflow: hidden;
`

function asPageSnapshot(snapshot: unknown): PageSnapshot | null {
  return snapshot !== null && snapshot !== undefined ? (snapshot as PageSnapshot) : null
}

interface PageContentChangeProps {
  before: PageSnapshot | null
  after: PageSnapshot | null
}

/** The page before and after the change, rendered as students see it, side by side. */
const PageContentChange: React.FC<PageContentChangeProps> = ({ before, after }) => {
  const { t } = useTranslation()
  if (before && after && JSON.stringify(before.content) === JSON.stringify(after.content)) {
    return <p>{t("agent-page-content-unchanged")}</p>
  }
  return (
    <div
      className={css`
        display: grid;
        grid-template-columns: 1fr;
        gap: 1rem;
        ${respondToOrLarger.lg} {
          grid-template-columns: ${before && after ? "1fr 1fr" : "1fr"};
        }
      `}
    >
      {before && (
        <section className={pageColumnCss} data-testid="agent-page-before">
          <h4 className={columnHeadingCss}>{t("agent-before")}</h4>
          <StagedPageContent snapshot={before} isConstrainedToContainer />
        </section>
      )}
      {after && (
        <section className={pageColumnCss} data-testid="agent-page-after">
          <h4 className={columnHeadingCss}>{t("agent-after")}</h4>
          <StagedPageContent snapshot={after} isConstrainedToContainer />
        </section>
      )}
    </div>
  )
}

interface EntityChangeProps {
  reviewEntity: ReviewEntity
  isChangesetOpen: boolean
}

/** One staged entity on the review page: what changes, why it matters, and whether it conflicts. */
const EntityChange: React.FC<EntityChangeProps> = ({ reviewEntity, isChangesetOpen }) => {
  const { t } = useTranslation()
  const router = useRouter()
  const entityTypeLabel = useEntityTypeLabel()
  const { entity, label, has_conflict: hasConflict } = reviewEntity
  const before = entity.base_snapshot ?? null
  const after = entity.after_snapshot ?? null
  const isPage = entity.entity_type === "page"

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
      aria-labelledby={`agent-entity-${entity.id}`}
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
          id={`agent-entity-${entity.id}`}
          className={css`
            font-size: 1.125rem;
            font-weight: ${fontWeights.semibold};
            color: ${baseTheme.colors.gray[700]};
            margin: 0;
            margin-right: auto;
          `}
        >
          {entityTypeLabel(entity.entity_type)}: {label}
        </h3>
        <OperationBadge operation={entity.operation} />
        {entity.risk_reasons.length > 0 && (
          <Badge tone={TONE.WARNING}>{t("agent-affects-students")}</Badge>
        )}
        {hasConflict && <Badge tone={TONE.DANGER}>{t("agent-changed-meanwhile")}</Badge>}
      </header>

      {entity.risk_reasons.length > 0 && <RiskReasonList reasons={entity.risk_reasons} />}

      {hasConflict && <p>{t("agent-entity-conflict-explanation")}</p>}

      <FieldChanges
        before={before}
        after={after}
        caption={t("agent-field-changes-caption", { label })}
      />

      {isPage && (
        <PageContentChange before={asPageSnapshot(before)} after={asPageSnapshot(after)} />
      )}

      {isPage && after !== null && isChangesetOpen && (
        <div>
          <Button
            variant="secondary"
            size="medium"
            isLoading={previewLinkMutation.isPending}
            data-testid="agent-open-preview-button"
            onPress={() =>
              previewLinkMutation.mutate({
                path: { changeset_id: entity.changeset_id, page_id: entity.entity_id },
              })
            }
          >
            {t("agent-open-preview")}
          </Button>
        </div>
      )}
    </article>
  )
}

export default EntityChange
