"use client"

import { css } from "@emotion/css"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"

import { coursePlanQueryKeys } from "../coursePlanQueryKeys"
import { coursePlanHubRoute } from "../coursePlanRoutes"

import CoursePlanList from "./CoursePlanList"

import {
  createCourseDesignerPlan,
  listCourseDesignerPlans,
} from "@/services/backend/courseDesigner"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"

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

export default function CoursePlansListPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const queryClient = useQueryClient()

  const plansQuery = useQuery({
    queryKey: coursePlanQueryKeys.list(),
    queryFn: () => listCourseDesignerPlans(),
  })

  const createPlanMutation = useToastMutation(
    () => createCourseDesignerPlan({}),
    { notify: true, method: "POST" },
    {
      onSuccess: async (plan) => {
        await queryClient.invalidateQueries({ queryKey: coursePlanQueryKeys.list() })
        router.push(coursePlanHubRoute(plan.id))
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

      {plansQuery.isSuccess && <CoursePlanList plans={plansQuery.data} />}
    </div>
  )
}
