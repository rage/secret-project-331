"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { useChatbotContext } from "@/components/course-material/chatbot/shared/ChatbotContext"
import useChatbotStateAndData from "@/components/course-material/chatbot/shared/hooks/useChatbotStateAndData"
import ChatbotChatBox from "@/components/course-material/ContentRenderer/moocfi/ChatbotBlock/ChatbotChatBox"
import ConversationIdContext from "@/contexts/course-material/ConversationIdContext"
import type { ChatbotConfiguration, Course } from "@/generated/api/types.generated"
import { getCurrentConversationIdOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import type { ChatbotConversation } from "@/generated/course-material-api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

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

const ChatbotCommandCenterImpl: React.FC = () => {
  const { t } = useTranslation()
  const [configurationId, setConfigurationId] = useState<null | string>(null)
  const [conversationId, setConversationId] = useState<null | string>(null)
  const [showChatbotDialog, setChatbotDialog] = useState(false)

  const {
    currentConversationInfo,
    newConversationMutation,
    messageState,
    toolResponseMutation,
    newMessage,
    newMessageMutation,
    isTurnInFlight,
    error,
    setNewMessage,
    stopTurn,
    chatbotMessageAnnouncement,
  } = useChatbotContext()

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
  }, [t])

  const handleConversationSelection = (conversationId, configurationId) => {
    setConversationId(conversationId)
    setConfigurationId(configurationId)
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
          newConversationMutation={newConversationMutation}
          onClose={() => setChatbotDialog(false)}
          open={showChatbotDialog}
        />
        {configurationId === null ? (
          <div className={chatbotPlaceHolder}></div>
        ) : (
          <ConversationIdContext.Provider value={setConversationId}>
            <ChatbotChatBox />
          </ConversationIdContext.Provider>
        )}
      </div>
    </div>
  )
}

export default ChatbotCommandCenterImpl
