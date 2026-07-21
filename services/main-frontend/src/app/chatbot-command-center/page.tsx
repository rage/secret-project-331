"use client"

import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import {
  getAllChatbotsOptions,
  getAllCoursesOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { QueryResults } from "@/shared-module/components"

import ChatbotCommandCenter from "./ChatbotCommandCenter"

const ChatbotCommandCenterPage: React.FC = () => {
  const { t } = useTranslation()
  usePageTitle(t("link-text-chatbot-command-center"))

  const chatbotsQuery = useQuery({
    ...getAllChatbotsOptions(),
  })

  const coursesQuery = useQuery({
    ...getAllCoursesOptions(),
  })

  return (
    <>
      <h1>{t("link-text-chatbot-command-center")}</h1>
      <QueryResults
        queries={[chatbotsQuery, coursesQuery] as const}
        renderData={([chatbotsData, coursesData]) => (
          <ChatbotCommandCenter chatbots={chatbotsData} courses={coursesData} />
        )}
      />
    </>
  )
}

export default withErrorBoundary(ChatbotCommandCenterPage)
