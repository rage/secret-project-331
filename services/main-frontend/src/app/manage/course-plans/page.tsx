"use client"

import { css } from "@emotion/css"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import React from "react"
import { useTranslation } from "react-i18next"

import {
  createCourseDesignerPlan,
  listCourseDesignerPlans,
} from "@/services/backend/courseDesigner"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const containerStyles = css`
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem;
`

const headerStyles = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
`

const listStyles = css`
  display: grid;
  gap: 1rem;
`

const cardStyles = css`
  border: 1px solid #d9dde4;
  border-radius: 12px;
  padding: 1rem;
  background: white;
`

const metaStyles = css`
  color: #5d6776;
  font-size: 0.95rem;
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 0.5rem;
`

// eslint-disable-next-line i18next/no-literal-string
const COURSE_DESIGNER_PLANS_QUERY_KEY = "course-designer-plans"

const coursePlanScheduleRoute = (planId: string) => {
  // eslint-disable-next-line i18next/no-literal-string
  return `/manage/course-plans/${planId}/schedule`
}

function CoursePlansPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const queryClient = useQueryClient()
  const plansQuery = useQuery({
    queryKey: [COURSE_DESIGNER_PLANS_QUERY_KEY],
    queryFn: () => listCourseDesignerPlans(),
  })

  const createPlanMutation = useToastMutation(
    () => createCourseDesignerPlan({}),
    { notify: true, method: "POST" },
    {
      onSuccess: async (plan) => {
        await queryClient.invalidateQueries({ queryKey: [COURSE_DESIGNER_PLANS_QUERY_KEY] })
        router.push(coursePlanScheduleRoute(plan.id))
      },
    },
  )

  return (
    <div className={containerStyles}>
      <div className={headerStyles}>
        <h1>{t("course-plans-title")}</h1>
        <Button
          variant="primary"
          size="medium"
          onClick={() => createPlanMutation.mutate()}
          disabled={createPlanMutation.isPending}
        >
          {t("course-plans-new-course-design")}
        </Button>
      </div>

      {plansQuery.isError && <ErrorBanner variant="readOnly" error={plansQuery.error} />}
      {plansQuery.isLoading && <Spinner variant="medium" />}

      {plansQuery.isSuccess && (
        <div className={listStyles}>
          {plansQuery.data.length === 0 && <p>{t("course-plans-empty")}</p>}
          {plansQuery.data.map((plan) => (
            <button
              type="button"
              key={plan.id}
              className={cardStyles}
              onClick={() => router.push(coursePlanScheduleRoute(plan.id))}
            >
              <div
                className={css`
                  display: flex;
                  justify-content: space-between;
                  gap: 1rem;
                  align-items: baseline;
                  text-align: left;
                  width: 100%;
                `}
              >
                <strong>{plan.name ?? t("course-plans-untitled-plan")}</strong>
                <span>{plan.status}</span>
              </div>
              <div className={metaStyles}>
                <span>{t("course-plans-members-count", { count: plan.member_count })}</span>
                <span>{t("course-plans-scheduled-stages-count", { count: plan.stage_count })}</span>
                <span>
                  {t("course-plans-active-stage-value", {
                    stage: plan.active_stage ?? t("course-plans-none"),
                  })}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default withErrorBoundary(withSignedIn(CoursePlansPage))
