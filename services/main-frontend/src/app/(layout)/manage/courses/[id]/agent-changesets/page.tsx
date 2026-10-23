"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import { useTranslation } from "react-i18next"

import { ChangesetStatusBadge } from "@/components/agent-changesets/ChangesetReview"
import { getAgentChangesetsOptions } from "@/generated/api/@tanstack/react-query.generated"
import type { ChangesetSummary } from "@/generated/api/types.generated"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { manageCourseAgentChangesetRoute } from "@/shared-module/common/utils/routes"
import { dateToString } from "@/shared-module/common/utils/time"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Badge, EmptyState, Link, QueryResult, Table, TONE } from "@/shared-module/components"

function AgentChangesetsPage() {
  const params = useParams<{ id: string }>()
  const { t } = useTranslation()
  const changesetsQuery = useQuery({
    ...getAgentChangesetsOptions({ query: { course_id: params.id } }),
  })

  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
        gap: 1rem;
      `}
    >
      <p>{t("agent-changesets-description")}</p>
      <QueryResult
        query={changesetsQuery}
        emptyFallback={
          <EmptyState title={t("agent-changesets-empty")} hint={t("agent-changesets-empty-hint")} />
        }
      >
        {(changesets) => (
          <Table<ChangesetSummary>
            caption={t("agent-changesets-caption")}
            data-testid="agent-changesets-table"
            // oxlint-disable-next-line i18next/no-literal-string
            responsive="stack"
            rows={changesets}
            rowKey={(summary) => summary.changeset.id}
            columns={[
              {
                header: t("agent-changesets-column-updated"),
                nowrap: true,
                cell: (summary) => (
                  <Link
                    href={manageCourseAgentChangesetRoute(params.id, summary.changeset.id)}
                    data-testid="agent-changeset-link"
                  >
                    {dateToString(summary.changeset.updated_at)}
                  </Link>
                ),
              },
              {
                header: t("agent-changesets-column-status"),
                cell: (summary) => <ChangesetStatusBadge status={summary.changeset.status} />,
              },
              {
                header: t("agent-changesets-column-changes"),
                grow: true,
                cell: (summary) => (
                  <span
                    className={css`
                      display: inline-flex;
                      flex-wrap: wrap;
                      gap: 0.5rem;
                      align-items: center;
                    `}
                  >
                    {t("agent-changes-count", { count: summary.entities.length })}
                    {summary.has_risky_changes && (
                      <Badge tone={TONE.WARNING}>{t("agent-affects-students")}</Badge>
                    )}
                    {summary.is_expiring_soon && (
                      <Badge tone={TONE.WARNING}>
                        {t("agent-expires-at", {
                          time: dateToString(summary.changeset.expires_at),
                        })}
                      </Badge>
                    )}
                  </span>
                ),
              },
            ]}
          />
        )}
      </QueryResult>
    </div>
  )
}

export default withErrorBoundary(withSignedIn(AgentChangesetsPage))
