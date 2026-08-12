"use client"

import React from "react"

import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import ChatbotEmbed from "./ChatbotEmbed"

const ChatbotEmbedPage: React.FC = () => {
  return <ChatbotEmbed />
}

export default withErrorBoundary(ChatbotEmbedPage)
