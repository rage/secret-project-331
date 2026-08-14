"use client"

import { css } from "@emotion/css"
import { skipToken, useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import ChatbotChat from "@/components/course-material/chatbot/shared/ChatbotChat"
import { IGNORE_BLOCK_FEEDBACK_CLASS } from "@/components/course-material/SelectionListener"
import { getDefaultChatbotConfigurationForCourse } from "@/generated/course-material-api/sdk.generated"
import type { ChatbotSurface } from "@/generated/course-material-api/types.generated"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { QueryResult } from "@/shared-module/components"

import type { BlockRendererProps } from "../.."

const SURFACE: ChatbotSurface = "course_material_block"

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
    enabled: courseId !== null && courseId !== undefined,
  })

  if (courseId === null || courseId === undefined) {
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
            surface={SURFACE}
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
                surface={SURFACE}
              />
            </div>
          </div>
        )
      }}
    </QueryResult>
  )
}

export default ChatbotBlock
