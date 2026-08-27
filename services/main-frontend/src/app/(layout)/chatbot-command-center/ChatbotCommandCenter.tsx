"use client"

import { css } from "@emotion/css"
import { useOverlayTriggerState } from "@react-stately/overlays"
import { useQuery } from "@tanstack/react-query"
import { AddMessage } from "@vectopus/atlas-icons-react"
import { useMemo, useState } from "react"
import { OverlayContainer } from "react-aria"
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
import { Disclosure } from "./Disclosure"
import MobileDisclosureOverlay from "./MobileDisclosureOverlay"
import NewConversationDialog from "./NewConversationDialog"

interface ChatbotCommandCenterProps {
  chatbots: ChatbotConfiguration[]
  courses: Course[]
  conversations: ChatbotConversation[]
}

const gridContainer = css`
  display: grid;
  grid-template-columns: auto 1fr;
  margin: 0 1rem;
  margin-top: 1rem;
  margin-bottom: 1rem;
  gap: 0.5rem;
`

const sideBarContainer = css`
  border-radius: 10px;
  margin: 0;
  padding: 0;
  padding-top: 0.5rem;
  overflow-y: auto;
  box-shadow: inset 0 0 0 1px ${baseTheme.colors.gray[100]};
  max-width: 400px;
  height: 85vh;
`

const chatbotPlaceHolder = css`
  display: flex;
  justify-content: center;
  align-items: center;
  height: inherit;
  border-radius: 10px;
  box-shadow: inset 0 0 0 1px ${baseTheme.colors.gray[100]};
`

const ChatbotCommandCenter = ({ chatbots, courses, conversations }: ChatbotCommandCenterProps) => {
  const { t } = useTranslation()
  const [configurationId, setConfigurationId] = useState<null | string>(null)
  const [conversationId, setConversationId] = useState<null | string>(null)
  const [showChatbotDialog, setChatbotDialog] = useState(false)

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
  const menuState = useOverlayTriggerState({})

  return (
    <div className={gridContainer}>
      <div className={sideBarContainer}>
        <MobileDisclosureOverlay state={menuState} onClose={menuState.close}>
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
        </MobileDisclosureOverlay>
        <Disclosure defaultExpanded={true}>
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
        </Disclosure>
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
