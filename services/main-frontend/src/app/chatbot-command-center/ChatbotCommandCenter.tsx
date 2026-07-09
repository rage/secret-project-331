"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"

import ChatbotChatBox from "@/components/course-material/ContentRenderer/moocfi/ChatbotBlock/ChatbotChatBox"
import useChatbotStateAndData from "@/components/course-material/chatbot/shared/hooks/useChatbotStateAndData"
import { getChatbotCommandCenterDataOptions } from "@/generated/api/@tanstack/react-query.generated"
import SelectMenu from "@/shared-module/common/components/SelectMenu"
import { QueryResult } from "@/shared-module/components"

const ChatbotCommandCenter = () => {
  const chatbotQuery = useQuery({
    ...getChatbotCommandCenterDataOptions(),
  })

  const [chatbotConfigurationId, setChatbotConfigurationId] = useState<string | undefined>()

  const chatbotStateAndData = useChatbotStateAndData(chatbotConfigurationId, undefined)

  useEffect(() => {
    chatbotStateAndData.newConversationMutation.mutate()
  }, [chatbotConfigurationId])

  return (
    <QueryResult query={chatbotQuery}>
      {(dataArray) => (
        <div>
          {chatbotConfigurationId === undefined
            ? setChatbotConfigurationId(dataArray[0]?.configuration_id)
            : ""}
          <SelectMenu
            id={"chatbot-select"}
            options={dataArray.map((data) => {
              return {
                label: `${data.course_name}: ${data.chatbot_name}`,
                value: data.configuration_id,
              }
            })}
            value={chatbotConfigurationId}
            onChange={(e) => setChatbotConfigurationId(e.currentTarget.value)}
            className={css`
              margin-bottom: 0;
              min-width: 120px;
            `}
            showDefaultOption={false}
          />
          <ChatbotChatBox {...chatbotStateAndData} />
        </div>
      )}
    </QueryResult>
  )
}

export default ChatbotCommandCenter
