"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { useRegisterBreadcrumbs } from "@/components/breadcrumbs/useRegisterBreadcrumbs"
import type { RouteTabDefinition } from "@/components/Navigation/RouteTabList/RouteTab"
import { RouteTabList } from "@/components/Navigation/RouteTabList/RouteTabList"
import { RouteTabListProvider } from "@/components/Navigation/RouteTabList/RouteTabListContext"
import { RouteTabPageTitle } from "@/components/Navigation/RouteTabList/RouteTabPageTitle"
import { getAgentChangesetCountsOptions } from "@/generated/api/@tanstack/react-query.generated"
import createFlaggedSuspectedCheaterCountHook from "@/hooks/count/useFlaggedSuspectedCheaterCount"
import createOpenAgentChangeCountHook from "@/hooks/count/useOpenAgentChangeCount"
import { useCourseQuery } from "@/hooks/useCourseQuery"
import useAuthorizeMultiple from "@/shared-module/common/hooks/useAuthorizeMultiple"
import {
  courseChatbotSettingsRoute,
  manageCourseAgentChangesetsRoute,
  manageCourseOtherCheatersRoute,
  manageCourseOtherCheatersSuspectedRoute,
  manageCourseOtherCodeGiveawaysRoute,
  manageCourseOtherExerciseResetToolRoute,
  manageCourseOtherGlossaryRoute,
  manageCourseOtherReferencesRoute,
} from "@/shared-module/common/utils/routes"

const KEY_REFERENCES = "references"
const KEY_GLOSSARY = "glossary"
const KEY_CHATBOT = "chatbot"
const KEY_CHEATERS = "cheaters"
const KEY_CODE_GIVEAWAYS = "code-giveaways"
const KEY_EXERCISE_RESET_TOOL = "exercise-reset-tool"
const KEY_AGENT_CHANGESETS = "agent-changesets"

export default function OtherLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>()
  const courseId = params.id
  const { t } = useTranslation()
  const courseQuery = useCourseQuery(courseId)

  const crumbs = useMemo(
    () => [
      {
        isLoading: false as const,
        label: t("title-other"),
        href: manageCourseOtherReferencesRoute(courseId),
      },
    ],
    [courseId, t],
  )

  useRegisterBreadcrumbs({ key: `course:${courseId}:other`, order: 30, crumbs })

  const showChatbotTab = courseQuery.data?.can_add_chatbot === true
  const flaggedCheaterCountHook = createFlaggedSuspectedCheaterCountHook(courseId)
  const openAgentChangeCountHook = createOpenAgentChangeCountHook(courseId)
  const permissionsQuery = useAuthorizeMultiple([
    { action: { type: "edit" }, resource: { type: "course", id: courseId } },
  ])
  const [canEdit = false] = permissionsQuery.data ?? []
  // Only teachers whose AI agent has staged changes in the course get the tab.
  const { data: hasAgentChangesets = false } = useQuery({
    ...getAgentChangesetCountsOptions({ query: { course_id: courseId } }),
    select: (counts) => counts.has_changesets,
    enabled: canEdit,
  })

  const tabs = useMemo((): RouteTabDefinition[] => {
    const base: RouteTabDefinition[] = [
      {
        key: KEY_REFERENCES,
        title: t("references"),
        href: manageCourseOtherReferencesRoute(courseId),
      },
      {
        key: KEY_GLOSSARY,
        title: t("link-glossary"),
        href: manageCourseOtherGlossaryRoute(courseId),
      },
    ]
    if (showChatbotTab) {
      base.push({
        key: KEY_CHATBOT,
        title: t("chatbots"),
        href: courseChatbotSettingsRoute(courseId),
      })
    }
    base.push(
      {
        key: KEY_CHEATERS,
        title: t("link-cheaters"),
        href: manageCourseOtherCheatersSuspectedRoute(courseId),
        pathPrefix: manageCourseOtherCheatersRoute(courseId),
        countHook: flaggedCheaterCountHook,
      },
      {
        key: KEY_CODE_GIVEAWAYS,
        title: t("heading-code-giveaways"),
        href: manageCourseOtherCodeGiveawaysRoute(courseId),
      },
      {
        key: KEY_EXERCISE_RESET_TOOL,
        title: t("label-exercise-reset-tool"),
        href: manageCourseOtherExerciseResetToolRoute(courseId),
      },
    )
    if (hasAgentChangesets) {
      base.push({
        key: KEY_AGENT_CHANGESETS,
        title: t("link-agent-changes"),
        href: manageCourseAgentChangesetsRoute(courseId),
        pathPrefix: manageCourseAgentChangesetsRoute(courseId),
        countHook: openAgentChangeCountHook,
      })
    }
    return base
  }, [
    courseId,
    t,
    showChatbotTab,
    flaggedCheaterCountHook,
    hasAgentChangesets,
    openAgentChangeCountHook,
  ])

  return (
    <RouteTabListProvider tabs={tabs}>
      <RouteTabPageTitle tabs={tabs} entityName={courseQuery.data?.name} order={20} />
      <RouteTabList tabs={tabs} />
      {children}
    </RouteTabListProvider>
  )
}
