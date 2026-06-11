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
  finished: boolean
}

export type ToolCallStatusProps = {
  messageType: "ToolCall"
  message: ChatbotConversationMessageToolCall
  finished: boolean
}

type StatusIndicatorProps = ToolCallStatusProps | ReasoningStatusProps

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ messageType, message, finished }) => {
  const { t } = useTranslation()
  let statusText

  if (messageType === "Reasoning") {
    statusText = finished ? t("chatbot-status-thinking-finished") : t("chatbot-status-thinking")
  } else {
    const tool_arguments = message.tool_arguments.length === 0 ? "" : ` ${message.tool_arguments}`
    const tool_text = finished
      ? t("chatbot-status-using-tool-finished")
      : t("chatbot-status-using-tool")
    statusText = `${tool_text} "${message.tool_name.replace("_", " ")}"${tool_arguments}`
  }

  return (
    <>
      <span className={style}>
        {statusText} {!finished && <ThinkingIndicator />}
      </span>
    </>
  )
}

export default StatusIndicator
