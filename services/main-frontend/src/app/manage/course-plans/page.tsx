"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"

import CoursePlanList from "./components/CoursePlanList"

import {
  createCourseDesignerPlanMutation,
  getCourseDesignerPlansOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { manageCoursePlanRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Button, QueryResult } from "@/shared-module/components"

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

function CoursePlansListPage() {
  const { t } = useTranslation()
  usePageTitle(t("course-plans-title"))
  const router = useRouter()

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

  return (
    <div className={containerStyles}>
      <div className={headerStyles}>
        <h1>{t("course-plans-title")}</h1>
        <Button
          variant="primary"
          size="medium"
          onClick={() => createPlanMutation.mutate({ body: {} })}
          disabled={createPlanMutation.isPending}
        >
          {t("course-plans-new-course-design")}
        </Button>
      </div>

      <QueryResult query={plansQuery}>{(plans) => <CoursePlanList plans={plans} />}</QueryResult>
    </div>
  )
}

export default withErrorBoundary(withSignedIn(CoursePlansListPage))
