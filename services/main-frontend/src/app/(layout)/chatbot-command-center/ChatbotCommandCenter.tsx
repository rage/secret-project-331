"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { AddMessage } from "@vectopus/atlas-icons-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import useChatbotStateAndData from "@/components/course-material/chatbot/shared/hooks/useChatbotStateAndData"
import ChatbotChatBox from "@/components/course-material/ContentRenderer/moocfi/ChatbotBlock/ChatbotChatBox"
import ConversationIdContext from "@/contexts/course-material/ConversationIdContext"
import type { ChatbotConfiguration, Course } from "@/generated/api/types.generated"
import {
  allUserConversationsOptions,
  getCurrentConversationIdOptions,
} from "@/generated/course-material-api/@tanstack/react-query.generated"
import { baseTheme } from "@/shared-module/common/styles"
import { Button, QueryResult } from "@/shared-module/components"

import ConversationHistory from "./ConversationHistory"
import NewConversationDialog from "./NewConversationDialog"

interface ChatbotCommandCenterProps {
  chatbots: ChatbotConfiguration[]
  courses: Course[]
}

const ChatbotCommandCenter = ({ chatbots, courses }: ChatbotCommandCenterProps) => {
  const { t } = useTranslation()
  const [configurationId, setConfigurationId] = useState<null | string>(null)
  const [conversationId, setConversationId] = useState<null | string>(null)
  const [showChatbotDialog, setChatbotDialog] = useState(false)

  const currentConversationIdQuery = useQuery(
    getCurrentConversationIdOptions({
      path: {
        chatbot_configuration_id: configurationId,
      },
    }),
  )

  const allConversationsQuery = useQuery(allUserConversationsOptions())

  const sideBarContainer = css`
    border-radius: 10px;
    box-shadow: inset 0 0 0 1px ${baseTheme.colors.gray[100]};
    margin: 0;
    padding: 0;
    margin-top: 1rem;
    padding-top: 1rem;
    overflow-y: auto;
    contain: size;
  `

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
  }, [chatbots, courses, t])

  const activeConversationId = currentConversationIdQuery.isLoading
    ? null
    : (conversationId ?? currentConversationIdQuery.data)

  const chatbotStateAndData = useChatbotStateAndData(
    configurationId,
    undefined,
    activeConversationId,
    setConversationId,
  )

  return (
    <div
      className={css`
        display: grid;
        grid-template-columns: 1fr 4fr;
        margin: 0 1rem;
        gap: 0.5rem;
        grid-auto-rows: min-content;
      `}
    >
      <div className={sideBarContainer}>
        <Button
          className={css`
            padding-bottom: 1rem;
          `}
          icon={
            <AddMessage
              className={css`
                color: ${baseTheme.colors.green[700]};
              `}
            />
          }
          // oxlint-disable-next-line i18next/no-literal-string
          iconPosition="start"
          size="medium"
          variant="icon"
          onClick={() => setChatbotDialog(true)}
        >
          {t("new-conversation")}
        </Button>
        <QueryResult query={allConversationsQuery}>
          {(conversations) => (
            <ConversationHistory
              conversations={conversations}
              setConversationId={setConversationId}
              setConfigurationId={setConfigurationId}
              chatbots={chatbots}
            />
          )}
        </QueryResult>
      </div>
      <div>
        <h1>{t("link-text-chatbot-command-center")}</h1>
        <div
          className={css`
            margin-top: 0.5rem;
            height: 75vh;
          `}
        >
          <NewConversationDialog
            chatbotOptions={chatbotOptions}
            setConfigurationId={setConfigurationId}
            newConversationMutation={chatbotStateAndData.newConversationMutation}
            onClose={() => setChatbotDialog(false)}
            open={showChatbotDialog}
          />
          {configurationId === null ? (
            <div
              className={css`
                display: flex;
                justify-content: center;
                align-items: center;
                height: 75vh;
                border-radius: 10px;
                box-shadow: inset 0 0 0 1px ${baseTheme.colors.gray[100]};
              `}
            ></div>
          ) : (
            <ConversationIdContext.Provider value={setConversationId}>
              <ChatbotChatBox {...chatbotStateAndData} />
            </ConversationIdContext.Provider>
          )}
        </div>
      </div>
    </div>
  )
}

export default ChatbotCommandCenter
