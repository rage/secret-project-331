"use client"

import { css } from "@emotion/css"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { z } from "zod"

import ChatbotDialog from "@/components/course-material/chatbot/Chatbot/ChatbotDialog"
import ChatbotChat from "@/components/course-material/chatbot/shared/ChatbotChat"
import {
  getCourseDesignerAssistantStatusOptions,
  getCourseDesignerPlanQueryKey,
  getCourseDesignerPlansQueryKey,
} from "@/generated/api/@tanstack/react-query.generated"
import { zCourseDesignerPlanDetails } from "@/generated/api/zod.generated"
import { baseTheme } from "@/shared-module/common/styles"

import { useInvalidatePlan } from "../../hooks/useInvalidatePlan"
import coursePlanAssistantEndpoints from "./coursePlanAssistantEndpoints"

const noticeStyle = css`
  margin: 0;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid ${baseTheme.colors.gray[100]};
  background: ${baseTheme.colors.gray[50]};
  color: ${baseTheme.colors.gray[600]};
  font-size: 0.85rem;
`

/** What every executed plan proposal sends the browser. */
const executedProposalSchema = z.object({ plan_details: zCourseDesignerPlanDetails })

/** The course design assistant's floating chat on a plan's pages, shown when the backend offers it. */
export default function CoursePlanAssistant({ planId }: { planId: string }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const invalidatePlan = useInvalidatePlan(planId)
  const statusQuery = useQuery(
    getCourseDesignerAssistantStatusOptions({ path: { plan_id: planId } }),
  )
  const endpoints = useMemo(() => coursePlanAssistantEndpoints(planId), [planId])

  const handleActionExecuted = useCallback(
    (_toolName: string, payload: unknown) => {
      const executed = executedProposalSchema.safeParse(payload)
      if (executed.success) {
        queryClient.setQueryData(
          getCourseDesignerPlanQueryKey({ path: { plan_id: planId } }),
          executed.data.plan_details,
        )
      } else {
        void invalidatePlan()
      }
      void queryClient.invalidateQueries({ queryKey: getCourseDesignerPlansQueryKey() })
    },
    [invalidatePlan, planId, queryClient],
  )

  if (!statusQuery.data?.available) {
    return null
  }

  return (
    // The key starts a fresh chat state when moving to another plan's pages.
    <ChatbotChat
      key={planId}
      endpoints={endpoints}
      isAlwaysOpen={false}
      pageId={null}
      onActionExecuted={handleActionExecuted}
    >
      <ChatbotDialog
        openButtonLabel={t("course-plans-assistant-open")}
        notice={
          statusQuery.data.has_guide_course ? undefined : (
            <p className={noticeStyle}>{t("course-plans-assistant-no-guide-course")}</p>
          )
        }
      />
    </ChatbotChat>
  )
}
