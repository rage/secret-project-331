"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"

import { pageTitleCss } from "@/components/credit-registration/styles"
import {
  createCourseDesignerPlanMutation,
  getCourseDesignerPlansOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { manageCoursePlanRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Button, Disclosure, QueryResult, useDialog } from "@/shared-module/components"

import CoursePlanList from "./components/CoursePlanList"

const headerStyles = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: var(--space-4);
`

const archivedSectionStyles = css`
  margin-top: var(--space-6);
`

const MAX_PLAN_NAME_LENGTH = 255

function CoursePlansListPage() {
  const { t } = useTranslation()
  usePageTitle(t("course-plans-title"))
  const router = useRouter()
  const { prompt } = useDialog()

  const plansQuery = useQuery({ ...getCourseDesignerPlansOptions() })

  const createPlanMutation = useToastMutationOptions(
    createCourseDesignerPlanMutation(),
    { notify: true, method: "POST" },
    {
      onSuccess: (plan) => {
        router.push(manageCoursePlanRoute(plan.id))
      },
    },
  )

  const handleCreatePlan = async () => {
    const result = await prompt({
      title: t("course-plans-new-plan-dialog-title"),
      message: t("course-plans-new-plan-dialog-name-label"),
      submitLabel: t("course-plans-new-plan-dialog-submit"),
      validate: (name) => {
        const trimmed = name.trim()
        if (trimmed.length === 0) {
          return t("course-plans-new-plan-dialog-name-required")
        }
        if (trimmed.length > MAX_PLAN_NAME_LENGTH) {
          return t("course-plans-new-plan-dialog-name-too-long", { max: MAX_PLAN_NAME_LENGTH })
        }
        return undefined
      },
    })
    if (result.isSubmitted && !createPlanMutation.isPending) {
      createPlanMutation.mutate({ body: { name: result.value.trim() } })
    }
  }

  return (
    <div>
      <div className={headerStyles}>
        <h1 className={pageTitleCss}>{t("course-plans-title")}</h1>
        <Button
          variant="primary"
          size="medium"
          onClick={() => void handleCreatePlan()}
          disabled={createPlanMutation.isPending || createPlanMutation.isSuccess}
        >
          {t("course-plans-new-course-design")}
        </Button>
      </div>

      <QueryResult query={plansQuery}>
        {(plans) => {
          const archivedPlans = plans.filter((plan) => plan.status === "Archived")
          return (
            <>
              <CoursePlanList
                plans={plans.filter((plan) => plan.status !== "Archived")}
                emptyTitle={
                  archivedPlans.length > 0 ? t("course-plans-no-active-plans") : undefined
                }
              />
              {archivedPlans.length > 0 && (
                <Disclosure
                  title={t("course-plans-archived-plans-heading", { count: archivedPlans.length })}
                  className={archivedSectionStyles}
                >
                  <CoursePlanList plans={archivedPlans} />
                </Disclosure>
              )}
            </>
          )
        }}
      </QueryResult>
    </div>
  )
}

export default withErrorBoundary(withSignedIn(CoursePlansListPage))
