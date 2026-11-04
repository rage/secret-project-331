"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"

import ChatbotChat from "@/components/course-material/chatbot/shared/ChatbotChat"
import ChatbotChatBox from "@/components/course-material/ContentRenderer/moocfi/ChatbotBlock/ChatbotChatBox"
import { getChatbotEmbedConfOptions } from "@/generated/api/@tanstack/react-query.generated"
import { QueryResult } from "@/shared-module/components"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

const ChatbotEmbed = () => {
  const { id } = useParams<{ id: string }>()
  const chatBotQuery = useQuery({
    ...optionalGeneratedQueryOptions({
      value: id,
      build: (value) =>
        getChatbotEmbedConfOptions({
          path: {
            chatbot_id: value,
          },
        }),
    }),
    enabled: Boolean(id),
    select: () => true,
  })

  return (
    <div>
      <QueryResult query={chatBotQuery} emptyFallback>
        {() => (
          <div
            className={css`
              height: 100vh;
            `}
          >
            <ChatbotChat chatbotConfigurationId={id} isAlwaysOpen={true} pageId={null}>
              <ChatbotChatBox />
            </ChatbotChat>
          </div>
        )}
      </QueryResult>
    </div>
  )
}

export default ChatbotEmbed
