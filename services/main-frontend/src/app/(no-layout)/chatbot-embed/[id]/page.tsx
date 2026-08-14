"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import ChatbotEmbed from "./ChatbotEmbed"

const ChatbotEmbedPage: React.FC = () => {
  const { t } = useTranslation()
  usePageTitle(t("title-chatbot"))
  return <ChatbotEmbed />
}

export default withErrorBoundary(ChatbotEmbedPage)
