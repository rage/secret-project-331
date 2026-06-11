"use client"

import { css } from "@emotion/css"
import { useTranslation } from "react-i18next"

import ThinkingIndicator from "./ThinkingIndicator"

import {
  ChatbotConversationMessageReasoning,
  ChatbotConversationMessageToolCall,
} from "@/generated/course-material-api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"

const style = css`
  padding: 0.5rem;
  border-radius: 10px;
  width: fit-content;
  max-width: stretch;
  color: rgb(0 0 0 / 70%);
  overflow-wrap: break-word;
  margin: 0.5rem 0;
  margin-right: 2rem;
  align-self: flex-start;
  background-color: ${baseTheme.colors.blue[100]};
`

export type ReasoningStatusProps = {
  messageType: "Reasoning"
  message: ChatbotConversationMessageReasoning
}

export type ToolCallStatusProps = {
  messageType: "ToolCall"
  message: ChatbotConversationMessageToolCall
}

type StatusIndicatorProps = ToolCallStatusProps | ReasoningStatusProps

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ messageType, message }) => {
  const { t } = useTranslation()
  let statusText

  if (messageType === "Reasoning") {
    statusText = t("chatbot-status-thinking")
  } else {
    const tool_arguments = message.tool_arguments.length === 0 ? "" : ` ${message.tool_arguments}`
    statusText = `${t("chatbot-status-using-tool")} "${message.tool_name}"${tool_arguments}`
  }

  return (
    <>
      <span className={style}>
        {statusText} <ThinkingIndicator />
      </span>
    </>
  )
}

export default StatusIndicator
