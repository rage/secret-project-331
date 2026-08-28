"use client"

import { css } from "@emotion/css"
import type { OverlayTriggerState } from "@react-stately/overlays"
import { useTranslation } from "react-i18next"

import type { ChatbotConfiguration } from "@/generated/api/types.generated"
import type { ChatbotConversation } from "@/generated/course-material-api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"
import { Button } from "@/shared-module/components"

interface ConversationHistory {
  setConversationId: React.Dispatch<string>
  conversations: ChatbotConversation[]
  setConfigurationId: React.Dispatch<string>
  chatbots: ChatbotConfiguration[]
  menuState?: OverlayTriggerState
}

const buttonCss = css`
  width: calc(100%);
  justify-content: flex-start;
  border-top: 1px solid ${baseTheme.colors.gray[75]};
  padding: 2rem 1rem;
  transition: background-color 0.2s;

  border-radius: 0;
  &:hover:not(:disabled):not([aria-disabled="true"]) {
    background: var(--color-green-75);
    color: var(--btn-icon-fg-hover);
    border-color: var(--color-green-300);
    box-shadow: var(--btn-icon-shadow-hover);
    border-radius: 6px;
  }
  color: var(--field-fg);
`

const chatbotLabelCss = css`
  padding: 5px 8px;
  font-size: 10px;
  white-space: nowrap;
  width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
  border: 1px solid ${baseTheme.colors.green[300]};
  border-radius: 999px;
  color: gray;
  max-width: 100px;
`

const ConversationHistory: React.FC<ConversationHistory> = ({
  setConversationId,
  conversations,
  setConfigurationId,
  chatbots,
  menuState,
}) => {
  const { t } = useTranslation()

  return (
    <>
      {/*             aria-label={t("unhide-course", { title: course.course_name })} */}
      {conversations.map((conversation) => (
        <Button
          size="medium"
          variant="icon"
          onClick={() => {
            setConversationId(conversation.id)
            setConfigurationId(conversation.chatbot_configuration_id)
            if (menuState) {
              menuState.close()
            }
          }}
          className={buttonCss}
          key={conversation.id}
          aria-label={t("select-conversation", { title: conversation.conversation_title })}
        >
          <div
            className={css`
              display: flex;
              flex-direction: column;
              align-items: flex-start;
              font-size: 14px;
              font-weight: 500;
            `}
          >
            <div
              className={css`
                white-space: nowrap;
                max-width: 300px;
                overflow: hidden;
                text-overflow: ellipsis;
                padding-bottom: 5px;
              `}
            >
              {conversation.conversation_title !== null
                ? conversation.conversation_title
                : // oxlint-disable-next-line i18next/no-literal-string
                  "untitled conversation"}
            </div>
            <span className={chatbotLabelCss}>
              {
                chatbots.find((chatbot) => chatbot.id === conversation.chatbot_configuration_id)
                  ?.chatbot_name
              }
            </span>
          </div>
        </Button>
      ))}
    </>
  )
}

export default ConversationHistory
