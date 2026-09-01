"use client"

import { css } from "@emotion/css"
import React, { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { useChatbotContext } from "@/components/course-material/chatbot/shared/ChatbotContext"
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
  margin-top: 1rem;
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
  configurationId
  setConfigurationId
}

const ChatbotCommandCenterImpl: React.FC<ChatbotCommandCenterImplProps> = ({
  chatbots,
  courses,
  conversations,
  configurationId,
  setConfigurationId,
}) => {
  const { t } = useTranslation()
  const [showChatbotDialog, setChatbotDialog] = useState(false)

  const { setConvId } = useChatbotContext()

  const chatbotOptions = useMemo(() => {
    const grouped = Object.values(
      chatbots.reduce(
        (acc, chatbot) => {
          const matched = courses.find((course) => course.id === chatbot.course_id)
          const courseName =
            matched !== undefined ? matched.name : t("select-chatbot-globals-title")

          // oxlint-disable-next-line i18next/no-literal-string
          const groupId = chatbot.course_id ?? "globals"

          if (!acc[groupId]) {
            acc[groupId] = {
              label: courseName,
              courseId: chatbot.course_id,
              options: [],
            }
          }
          acc[groupId].options.push({
            label: chatbot.chatbot_name,
            value: chatbot.id,
          })

          return acc
        },
        {} as Record<
          string,
          {
            label: string
            courseId: string | null | undefined
            options: { label: string; value: string }[]
          }
        >,
      ),
    )

    const groupedSorted = grouped.toSorted((a, b) => {
      if (!a.courseId && b.courseId) {
        return -1
      }
      if (a.courseId && !b.courseId) {
        return 1
      }
      return a.label.localeCompare(b.label)
    })
    return groupedSorted
  }, [courses, chatbots, t])

  const handleConversationSelection = (convId: string, confId: string) => {
    setConvId(convId)
    setConfigurationId(confId)
  }
  return (
    <div className={gridContainer}>
      <SideBar
        setChatbotDialog={setChatbotDialog}
        conversations={conversations}
        chatbots={chatbots}
        handleConversationSelection={handleConversationSelection}
      />
      <div
        className={css`
          height: 85vh;
        `}
      >
        <NewConversationDialog
          chatbotOptions={chatbotOptions}
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
