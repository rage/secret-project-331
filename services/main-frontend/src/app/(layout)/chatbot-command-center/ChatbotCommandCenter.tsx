"use client"

import { useQuery } from "@tanstack/react-query"
import type React from "react"
import { useState } from "react"

import ChatbotChat from "@/components/course-material/chatbot/shared/ChatbotChat"
import type { ChatbotConfiguration, Course } from "@/generated/api/types.generated"
import { getCurrentConversationIdOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import type { ChatbotConversation } from "@/generated/course-material-api/types.generated"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

import ChatbotCommandCenterImpl from "./ChatbotCommandCenterImpl"

interface ChatbotCommandCenterProps {
  chatbots: ChatbotConfiguration[]
  courses: Course[]
  conversations: ChatbotConversation[]
}

const ChatbotCommandCenter: React.FC<ChatbotCommandCenterProps> = ({
  chatbots,
  courses,
  conversations,
}) => {
  const [configurationId, setConfigurationId] = useState<null | string>(null)
  const [conversationId, setConversationId] = useState<null | string>(null)

  const currentConversationIdQuery = useQuery(
    optionalGeneratedQueryOptions({
      value: configurationId,
      isReady: (c): c is string => Boolean(c),
      build: (c) =>
        getCurrentConversationIdOptions({
          path: {
            chatbot_configuration_id: c,
          },
        }),
    }),
  )

  const activeConversationId = currentConversationIdQuery.isLoading
    ? null
    : (conversationId ?? currentConversationIdQuery.data)

  return (
    <ChatbotChat
      chatbotConfigurationId={configurationId}
      isAlwaysOpen={true}
      conversationId={activeConversationId}
      pageId={null}
    >
      <ChatbotCommandCenterImpl
        chatbots={chatbots}
        courses={courses}
        conversations={conversations}
        setConfigurationId={setConfigurationId}
        configurationId={configurationId}
        setConversationId={setConversationId}
      />
    </ChatbotChat>
  )
}

export default ChatbotCommandCenter
