"use client"

import { css } from "@emotion/css"
import { useEffect, useState } from "react"

import ChatbotChatBox from "@/components/course-material/ContentRenderer/moocfi/ChatbotBlock/ChatbotChatBox"
import useChatbotStateAndData from "@/components/course-material/chatbot/shared/hooks/useChatbotStateAndData"
import SelectMenu from "@/shared-module/common/components/SelectMenu"

interface ChatbotCommandCenterData {
  configuration_id: string
  chatbot_name: string
  course_name: string
}

interface Props {
  chatbotData: ChatbotCommandCenterData[]
}

const ChatbotCommandCenter = ({ chatbotData }: Props) => {
  const firstChatbot = chatbotData[0].configuration_id
  const [chatbotConfigurationId, setChatbotConfigurationId] = useState(firstChatbot)

  const chatbotStateAndData = useChatbotStateAndData(chatbotConfigurationId, undefined)

  useEffect(() => {
    chatbotStateAndData.newConversationMutation.mutate()
  }, [chatbotConfigurationId])

  return (
    <div>
      <SelectMenu
        id={"chatbot-select"}
        options={chatbotData.map((data) => {
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
      <div
        className={css`
          height: 75vh;
        `}
      >
        <ChatbotChatBox {...chatbotStateAndData} />
      </div>
    </div>
  )
}

export default ChatbotCommandCenter
