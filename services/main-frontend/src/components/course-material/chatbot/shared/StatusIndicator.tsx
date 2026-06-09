"use client"

import { css } from "@emotion/css"

import ThinkingIndicator from "./ThinkingIndicator"

import { ChatbotChatStreamEvent } from "@/generated/course-material-api/types.generated"
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

interface StatusIndicatorProps {
  // type this better?
  status: ChatbotChatStreamEvent
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status }) => {
  // translate stuff!
  let statusText = ""
  if (status.type === "Reasoning") {
    // eslint-disable-next-line i18next/no-literal-string
    statusText = "Thinking"
  } else if (status.type === "ToolCall") {
    // eslint-disable-next-line i18next/no-literal-string
    statusText = `Using tool "${status.data.tool_name}" with query: ${status.data.arguments}`
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
