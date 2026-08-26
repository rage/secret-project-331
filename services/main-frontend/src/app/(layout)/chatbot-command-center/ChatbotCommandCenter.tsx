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
import { getCurrentConversationIdOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import type { ChatbotConversation } from "@/generated/course-material-api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"
import { Button } from "@/shared-module/components"

import ConversationHistory from "./ConversationHistory"
import NewConversationDialog from "./NewConversationDialog"

interface ChatbotCommandCenterProps {
  chatbots: ChatbotConfiguration[]
  courses: Course[]
  conversations: ChatbotConversation[]
}

const ChatbotCommandCenter = ({ chatbots, courses, conversations }: ChatbotCommandCenterProps) => {
  const { t } = useTranslation()
  const [configurationId, setConfigurationId] = useState<null | string>(null)
  const [conversationId, setConversationId] = useState<null | string>(null)
  const [showChatbotDialog, setChatbotDialog] = useState(false)

  const gridContainer = css`
    display: grid;
    grid-template-columns: 1fr 4fr;
    margin: 0 1rem;
    margin-top: 1rem;
    margin-bottom: 1rem;
    gap: 0.5rem;
    grid-auto-rows: min-content;
  `

  const sideBarContainer = css`
    border-radius: 10px;
    box-shadow: inset 0 0 0 1px ${baseTheme.colors.gray[100]};
    margin: 0;
    padding: 0;
    padding-top: 1rem;
    overflow-y: auto;
    contain: size;
  `

  const chatbotPlaceHolder = css`
    display: flex;
    justify-content: center;
    align-items: center;
    height: inherit;
    border-radius: 10px;
    box-shadow: inset 0 0 0 1px ${baseTheme.colors.gray[100]};
  `

  const currentConversationIdQuery = useQuery({
    ...getCurrentConversationIdOptions({
      path: {
        chatbot_configuration_id: configurationId,
      },
    }),
    enabled: configurationId !== null,
  })

  const activeConversationId = currentConversationIdQuery.isLoading
    ? null
    : (conversationId ?? currentConversationIdQuery.data)

  const chatbotStateAndData = useChatbotStateAndData(
    configurationId,
    undefined,
    activeConversationId,
    setConversationId,
  )

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

  return (
    <div className={gridContainer}>
      <div className={sideBarContainer}>
        <Button
          className={css`
            padding-bottom: 1rem;
            color: var(--field-fg);
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
        <ConversationHistory
          conversations={conversations}
          setConversationId={setConversationId}
          setConfigurationId={setConfigurationId}
          chatbots={chatbots}
        />
      </div>
      <div
        className={css`
          height: 85vh;
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
          <div className={chatbotPlaceHolder}></div>
        ) : (
          <ConversationIdContext.Provider value={setConversationId}>
            <ChatbotChatBox {...chatbotStateAndData} />
          </ConversationIdContext.Provider>
        )}
      </div>
    </div>
  )
}

export default ChatbotCommandCenter
