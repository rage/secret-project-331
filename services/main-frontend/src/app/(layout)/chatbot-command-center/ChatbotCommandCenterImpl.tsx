"use client"

import { css } from "@emotion/css"
import React, { useState } from "react"

import ChatbotChatBox from "@/components/course-material/ContentRenderer/moocfi/ChatbotBlock/ChatbotChatBox"
import type { ChatbotConfiguration, Course } from "@/generated/api/types.generated"
import type { ChatbotConversation } from "@/generated/course-material-api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"

import NewConversationDialog from "./NewConversationDialog"
import SideBar from "./SideBar"

const gridContainer = css`
  display: grid;
  grid-template-columns: auto 1fr;
  margin: 0 1rem;
  margin-bottom: 1rem;
  gap: 0.5rem;
`

const chatbotPlaceHolder = css`
  display: flex;
  justify-content: center;
  align-items: center;
  height: inherit;
  border-radius: 10px;
  box-shadow: inset 0 0 0 1px ${baseTheme.colors.gray[100]};
`

interface ChatbotCommandCenterImplProps {
  chatbots: ChatbotConfiguration[]
  courses: Course[]
  conversations: ChatbotConversation[]
  configurationId: string | null
  setConfigurationId: React.Dispatch<string | null>
}

const ChatbotCommandCenterImpl: React.FC<ChatbotCommandCenterImplProps> = ({
  chatbots,
  courses,
  conversations,
  configurationId,
  setConfigurationId,
}) => {
  const [showChatbotDialog, setChatbotDialog] = useState(false)

  return (
    <div className={gridContainer}>
      <SideBar
        setChatbotDialog={setChatbotDialog}
        conversations={conversations}
        chatbots={chatbots}
        setConfigurationId={setConfigurationId}
      />
      <div
        className={css`
          height: 85vh;
        `}
      >
        <NewConversationDialog
          chatbots={chatbots}
          courses={courses}
          setConfigurationId={setConfigurationId}
          onClose={() => setChatbotDialog(false)}
          open={showChatbotDialog}
        />
        {configurationId === null ? <div className={chatbotPlaceHolder}></div> : <ChatbotChatBox />}
      </div>
    </div>
  )
}

export default ChatbotCommandCenterImpl
