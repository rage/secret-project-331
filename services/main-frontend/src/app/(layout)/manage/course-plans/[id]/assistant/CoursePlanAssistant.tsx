"use client"

import { css, cx } from "@emotion/css"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import React, { createContext, useCallback, useContext, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { z } from "zod"

import ChatbotChat from "@/components/course-material/chatbot/shared/ChatbotChat"
import ChatbotChatBody from "@/components/course-material/chatbot/shared/ChatbotChatBody"
import ChatbotChatHeader from "@/components/course-material/chatbot/shared/ChatbotChatHeader"
import {
  getCourseDesignerAssistantStatusOptions,
  getCourseDesignerPlanQueryKey,
  getCourseDesignerPlansQueryKey,
} from "@/generated/api/@tanstack/react-query.generated"
import type { CourseDesignerAssistantStatus } from "@/generated/api/types.generated"
import { zCourseDesignerPlanDetails } from "@/generated/api/zod.generated"
import { baseTheme } from "@/shared-module/common/styles"

import { useInvalidatePlan } from "../../hooks/useInvalidatePlan"
import coursePlanAssistantEndpoints from "./coursePlanAssistantEndpoints"

const panelStyles = css`
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: white;
  border-radius: 12px;
  border: 1px solid ${baseTheme.colors.gray[200]};
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
  overflow: hidden;
`

const noticeStyles = css`
  margin: 0;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid ${baseTheme.colors.gray[100]};
  background: ${baseTheme.colors.gray[50]};
  color: ${baseTheme.colors.gray[600]};
  font-size: 0.85rem;
`

const unavailableStyles = css`
  margin: 0;
  padding: 1.5rem;
  color: ${baseTheme.colors.gray[600]};
  font-size: 0.9rem;
  line-height: 1.55;
`

/** What every executed plan proposal sends the browser. */
const executedProposalSchema = z.object({ plan_details: zCourseDesignerPlanDetails })

const AssistantStatusContext = createContext<CourseDesignerAssistantStatus | undefined>(undefined)

/**
 * Holds the course design assistant's chat for a plan, so the conversation survives switching
 * between the tabs that render `CoursePlanAssistantPanel`.
 */
export function CoursePlanAssistantProvider({
  planId,
  children,
}: {
  planId: string
  children: React.ReactNode
}) {
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

  const status = statusQuery.data
  return (
    <AssistantStatusContext value={status}>
      {status?.available ? (
        // The key starts a fresh chat state when moving to another plan.
        <ChatbotChat
          key={planId}
          endpoints={endpoints}
          isAlwaysOpen={true}
          pageId={null}
          onActionExecuted={handleActionExecuted}
        >
          {children}
        </ChatbotChat>
      ) : (
        children
      )}
    </AssistantStatusContext>
  )
}

/** The assistant's reserved, always visible area; must be inside `CoursePlanAssistantProvider`. */
export function CoursePlanAssistantPanel({ className }: { className?: string }) {
  const { t } = useTranslation()
  const status = useContext(AssistantStatusContext)

  return (
    <section className={cx(panelStyles, className)} aria-label={t("course-plans-assistant-name")}>
      {status?.available ? (
        <>
          <ChatbotChatHeader isAlwaysOpen={true} />
          {!status.has_guide_course && (
            <p className={noticeStyles}>{t("course-plans-assistant-no-guide-course")}</p>
          )}
          <ChatbotChatBody />
        </>
      ) : (
        status && <p className={unavailableStyles}>{t("course-plans-assistant-unavailable")}</p>
      )}
    </section>
  )
}
