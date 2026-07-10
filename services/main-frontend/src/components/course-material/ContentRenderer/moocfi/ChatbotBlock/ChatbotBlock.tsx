"use client"

import { css } from "@emotion/css"
import { skipToken, useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import type { BlockRendererProps } from "../.."

import { IGNORE_BLOCK_FEEDBACK_CLASS } from "@/components/course-material/SelectionListener"
import ChatbotChat from "@/components/course-material/chatbot/shared/ChatbotChat"
import { getDefaultChatbotConfigurationForCourse } from "@/generated/course-material-api/sdk.generated"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { QueryResult } from "@/shared-module/components"

interface ChatbotBlockProps {
  chatbotConfigurationId: string
  courseId: string
}

const ChatbotBlock: React.FC<BlockRendererProps<ChatbotBlockProps>> = ({ data }) => {
  const { t } = useTranslation()
  const chatbotConfigurationId = data.attributes.chatbotConfigurationId
  const courseId = data.attributes.courseId

  const defaultChatbotConfiguration = useQuery({
    queryKey: ["chatbot", "default-for-course", courseId],
    queryFn: courseId
      ? () =>
          getDefaultChatbotConfigurationForCourse({
            path: {
              course_id: courseId,
            },
          })
      : skipToken,
    enabled: courseId != null,
  })

  if (courseId == null) {
    return (
      <div className={IGNORE_BLOCK_FEEDBACK_CLASS}>
        <div
          className={css`
            display: block;
            height: min(500px, 95vh);
            ${respondToOrLarger.sm} {
              height: min(900px, 95vh);
            }
          `}
        >
          <ChatbotChat
            chatbotConfigurationId={chatbotConfigurationId}
            isCourseMaterialBlock={true}
          />
        </div>
      </div>
    )
  }

  return (
    <QueryResult query={defaultChatbotConfiguration}>
      {(defaultChatbotConfigurationId) => {
        if (chatbotConfigurationId === defaultChatbotConfigurationId) {
          return <ErrorBanner variant={"readOnly"} error={t("error-default-chatbot-in-block")} />
        }

        return (
          <div className={IGNORE_BLOCK_FEEDBACK_CLASS}>
            <div
              className={css`
                display: block;
                height: min(500px, 95vh);
                ${respondToOrLarger.sm} {
                  height: min(900px, 95vh);
                }
              `}
            >
              <ChatbotChat
                chatbotConfigurationId={chatbotConfigurationId}
                isCourseMaterialBlock={true}
              />
            </div>
          </div>
        )
      }}
    </QueryResult>
  )
}

export default ChatbotBlock
