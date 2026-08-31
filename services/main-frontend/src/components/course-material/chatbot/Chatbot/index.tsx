"use client"

import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import React from "react"

import { getCurrentConversationIdOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import { QueryResult } from "@/shared-module/components"
import { currentPageIdAtom } from "@/state/course-material/selectors"

import ChatbotChat from "../shared/ChatbotChat"

export interface ChatbotProps {
  chatbotConfigurationId: string
}

const Chatbot: React.FC<ChatbotProps> = ({ chatbotConfigurationId }) => {
  const currentConversationIdQuery = useQuery(
    getCurrentConversationIdOptions({
      path: {
        chatbot_configuration_id: chatbotConfigurationId,
      },
    }),
  )
  const pageId = useAtomValue(currentPageIdAtom)

  return (
    <QueryResult query={currentConversationIdQuery}>
      {(conversationId) => (
        <ChatbotChat
          conversationId={conversationId}
          chatbotConfigurationId={chatbotConfigurationId}
          isCourseMaterialBlock={false}
          pageId={pageId}
        />
      )}
    </QueryResult>
  )
}

export default React.memo(Chatbot)
