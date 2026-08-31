"use client"

import { css } from "@emotion/css"
import { skipToken, useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { useTranslation } from "react-i18next"

import ChatbotChat from "@/components/course-material/chatbot/shared/ChatbotChat"
import { IGNORE_BLOCK_FEEDBACK_CLASS } from "@/components/course-material/SelectionListener"
import { getCurrentConversationIdOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import { getDefaultChatbotConfigurationForCourse } from "@/generated/course-material-api/sdk.generated"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { QueryResult } from "@/shared-module/components"
import { currentPageIdAtom } from "@/state/course-material/selectors"

import type { BlockRendererProps } from "../.."

interface ChatbotBlockProps {
  chatbotConfigurationId: string
  courseId: string
}

const ChatbotBlock: React.FC<BlockRendererProps<ChatbotBlockProps>> = ({ data }) => {
  const { t } = useTranslation()
  const chatbotConfigurationId = data.attributes.chatbotConfigurationId
  const courseId = data.attributes.courseId
  const pageId = useAtomValue(currentPageIdAtom)

  const currentConversationIdQuery = useQuery(
    getCurrentConversationIdOptions({
      path: {
        chatbot_configuration_id: chatbotConfigurationId,
      },
    }),
  )

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
          <QueryResult query={currentConversationIdQuery}>
            {(currentConversation) => (
              <ChatbotChat
                conversationId={currentConversation}
                chatbotConfigurationId={chatbotConfigurationId}
                isCourseMaterialBlock={true}
                pageId={pageId}
              />
            )}
          </QueryResult>
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
              <QueryResult query={currentConversationIdQuery}>
                {(currentConversation) => (
                  <ChatbotChat
                    conversationId={currentConversation}
                    chatbotConfigurationId={chatbotConfigurationId}
                    isCourseMaterialBlock={true}
                    pageId={pageId}
                  />
                )}
              </QueryResult>
            </div>
          </div>
        )
      }}
    </QueryResult>
  )
}

export default ChatbotBlock
