"use client"

import { useParams } from "next/navigation"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import type { RouteTabDefinition } from "@/components/Navigation/RouteTabList/RouteTab"
import { RouteTabList } from "@/components/Navigation/RouteTabList/RouteTabList"
import { RouteTabListProvider } from "@/components/Navigation/RouteTabList/RouteTabListContext"
import { useCourseQuery } from "@/hooks/useCourseQuery"
import {
  courseChatbotSettingsRoute,
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

export default function OtherLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>()
  const courseId = params.id
  const { t } = useTranslation()
  const courseQuery = useCourseQuery(courseId)

  const showChatbotTab = courseQuery.data?.can_add_chatbot === true

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
    return base
  }, [courseId, t, showChatbotTab])

  return (
    <RouteTabListProvider tabs={tabs}>
      <RouteTabList tabs={tabs} />
      {children}
    </RouteTabListProvider>
  )
}
