"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import ChatbotCommandCenter from "./ChatbotCommandCenter"

import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const ChatbotCommandCenterPage: React.FC = () => {
  const { t } = useTranslation()
  usePageTitle(t("chatbot-command-center-heading"))

  return (
    <>
      <h1>{t("title-chatbot-command-center")}</h1>
      <ChatbotCommandCenter />
    </>
  )
}

export default withErrorBoundary(ChatbotCommandCenterPage)
