import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { BlockRendererProps } from "../.."

import ChatbotChatBox from "./ChatbotChatBox"

import { IGNORE_BLOCK_FEEDBACK_CLASS } from "@/components/SelectionListener"
import { getDefaultChatbotConfigurationForCourse } from "@/services/backend"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

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
    queryFn: () => getDefaultChatbotConfigurationForCourse(assertNotNullOrUndefined(courseId)),
    enabled: courseId != null,
  })

  if (defaultChatbotConfiguration.isLoading) {
    return <Spinner />
  }
  if (defaultChatbotConfiguration.isError) {
    return <ErrorBanner error={defaultChatbotConfiguration.error} />
  }

  if (chatbotConfigurationId === defaultChatbotConfiguration.data) {
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
        <ChatbotChatBox chatbotConfigurationId={chatbotConfigurationId} />
      </div>
    </div>
  )
}

export default ChatbotBlock
