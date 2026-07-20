"use client"

import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { getChatbotCommandCenterDataOptions } from "@/generated/api/@tanstack/react-query.generated"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { QueryResult } from "@/shared-module/components"

import ChatbotCommandCenter from "./ChatbotCommandCenter"

const ChatbotCommandCenterPage: React.FC = () => {
  const { t } = useTranslation()
  usePageTitle(t("link-text-chatbot-command-center"))

  const chatbotQuery = useQuery({
    ...getChatbotCommandCenterDataOptions(),
  })

  return (
    <>
      <h1>{t("link-text-chatbot-command-center")}</h1>
      <QueryResult query={chatbotQuery}>
        {(data) => <ChatbotCommandCenter chatbots={data} />}
      </QueryResult>
    </>
  )
}

export default withErrorBoundary(ChatbotCommandCenterPage)
