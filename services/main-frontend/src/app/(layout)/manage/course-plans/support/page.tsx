"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import type { TFunction } from "i18next"
import { useTranslation } from "react-i18next"

import { TABLE_STACK } from "@/components/credit-registration/constants"
import { pageTitleCss } from "@/components/credit-registration/styles"
import { getCourseDesignerSupportPlansOptions } from "@/generated/api/@tanstack/react-query.generated"
import type {
  CourseDesignerPlanStatus,
  CourseDesignerSupportPlan,
} from "@/generated/api/types.generated"
import OnlyRenderIfPermissions from "@/shared-module/common/components/OnlyRenderIfPermissions"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import { baseTheme } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import {
  Badge,
  type BadgeTone,
  EmptyState,
  QueryResult,
  Table,
  TONE,
} from "@/shared-module/components"

import { daysUntilPlanDate, formatPlanDate } from "../coursePlanDates"
import { formatPlanMemberName } from "../coursePlanMembers"
import { stageLabel } from "../coursePlanStages"
import CourseDesignAssistantSection from "./CourseDesignAssistantSection"

const introStyles = css`
  margin: 0 0 1.5rem;
  color: ${baseTheme.colors.gray[600]};
`

const cellStackStyles = css`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
`

const mutedStyles = css`
  font-size: 0.85rem;
  color: ${baseTheme.colors.gray[500]};
`

const detailsStyles = css`
  padding: 0.5rem 0;

  h3 {
    margin: 0 0 0.5rem;
    font-size: 0.95rem;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
`

const stageRowStyles = css`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
`

function planStatusLabel(status: CourseDesignerPlanStatus, t: TFunction): string {
  switch (status) {
    case "Draft":
      return t("course-plans-status-draft")
    case "Scheduling":
      return t("course-plans-status-scheduling")
    case "InProgress":
      return t("course-plans-status-in-progress")
    case "Completed":
      return t("course-plans-status-completed")
    case "Archived":
      return t("course-plans-status-archived")
  }
}

/** Days the active stage is past its planned end, or `null` when it is on schedule. */
function overdueDays(supportPlan: CourseDesignerSupportPlan): number | null {
  if (supportPlan.plan.status !== "InProgress") {
    return null
  }
  const activeStage = supportPlan.stages.find(
    (stage) => stage.stage === supportPlan.plan.active_stage,
  )
  if (activeStage === undefined) {
    return null
  }
  const daysLeft = daysUntilPlanDate(activeStage.planned_ends_on)
  return daysLeft < 0 ? -daysLeft : null
}

function scheduleHealth(supportPlan: CourseDesignerSupportPlan, t: TFunction) {
  if (supportPlan.plan.status !== "InProgress") {
    return null
  }
  const overdue = overdueDays(supportPlan)
  const tone: BadgeTone = overdue === null ? TONE.SUCCESS : TONE.DANGER
  return (
    <Badge tone={tone} size="compact">
      {overdue === null
        ? t("course-plans-support-on-schedule")
        : t("course-plans-deadline-days-overdue", { count: overdue })}
    </Badge>
  )
}

/** Read-only overview of every course plan, for global admins helping teachers design MOOCs. */
function CoursePlansSupportPage() {
  const { t, i18n } = useTranslation()
  usePageTitle(t("course-plans-support-title"))
  const plansQuery = useQuery(getCourseDesignerSupportPlansOptions())

  return (
    <div>
      <h1 className={pageTitleCss}>{t("course-plans-support-title")}</h1>
      <p className={introStyles}>{t("course-plans-support-description")}</p>
      <QueryResult
        query={plansQuery}
        emptyFallback={<EmptyState title={t("course-plans-support-empty")} />}
      >
        {(plans) => (
          <Table
            caption={t("course-plans-support-title")}
            rows={plans}
            rowKey={(row) => row.plan.id}
            responsive={TABLE_STACK}
            columns={[
              {
                header: t("course-plans-support-column-plan"),
                grow: true,
                cell: (row) => (
                  <span className={cellStackStyles}>
                    <strong>{row.plan.name ?? t("course-plans-untitled-plan")}</strong>
                    <span className={mutedStyles}>
                      {row.members.map((member) => formatPlanMemberName(member)).join(", ")}
                    </span>
                  </span>
                ),
              },
              {
                header: t("course-plans-support-column-status"),
                cell: (row) => planStatusLabel(row.plan.status, t),
              },
              {
                header: t("course-plans-support-column-active-stage"),
                cell: (row) =>
                  row.plan.active_stage
                    ? stageLabel(row.plan.active_stage, t)
                    : t("course-plans-none"),
              },
              {
                header: t("course-plans-support-column-schedule"),
                cell: (row) => scheduleHealth(row, t),
              },
              {
                header: t("course-plans-support-column-tasks"),
                cell: (row) =>
                  t("course-plans-support-tasks-done", {
                    completed: row.stages.reduce(
                      (sum, stage) => sum + stage.completed_task_count,
                      0,
                    ),
                    total: row.stages.reduce((sum, stage) => sum + stage.task_count, 0),
                  }),
              },
            ]}
            expandableRow={(row) => <SupportPlanDetails supportPlan={row} locale={i18n.language} />}
          />
        )}
      </QueryResult>
      <OnlyRenderIfPermissions
        action={{ type: "administrate" }}
        resource={{ type: "global_permissions" }}
      >
        <CourseDesignAssistantSection />
      </OnlyRenderIfPermissions>
    </div>
  )
}

function SupportPlanDetails({
  supportPlan,
  locale,
}: {
  supportPlan: CourseDesignerSupportPlan
  locale: string
}) {
  const { t } = useTranslation()
  return (
    <div className={detailsStyles}>
      <div>
        <h3>{t("course-plans-support-stages-heading")}</h3>
        <ul>
          {supportPlan.stages.map((stage) => (
            <li key={stage.stage} className={stageRowStyles}>
              <strong>{stageLabel(stage.stage, t)}</strong>
              <span className={mutedStyles}>
                {t("course-plans-overview-stage-dates", {
                  startsOn: formatPlanDate(stage.planned_starts_on, locale),
                  endsOn: formatPlanDate(stage.planned_ends_on, locale),
                })}
              </span>
              <span className={mutedStyles}>
                {t("course-plans-overview-phase-tasks-progress", {
                  completed: stage.completed_task_count,
                  total: stage.task_count,
                })}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default withErrorBoundary(withSignedIn(CoursePlansSupportPage))
