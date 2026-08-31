"use client"

import type React from "react"

import ChatbotChat from "@/components/course-material/chatbot/shared/ChatbotChat"
import type { ChatbotConfiguration, Course } from "@/generated/api/types.generated"
import type { ChatbotConversation } from "@/generated/course-material-api/types.generated"

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

  return (
    <ChatbotChat
      chatbotConfigurationId={null}
      isAlwaysOpen={true}
      conversationId={null}
      pageId={null}
    >
      <ChatbotCommandCenterImpl
        chatbots={chatbots}
        courses={courses}
        conversations={conversations}
      />
    </ChatbotChat>
  )
}

export default ChatbotCommandCenter
