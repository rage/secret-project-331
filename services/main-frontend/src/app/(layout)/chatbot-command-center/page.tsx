"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import {
  getAllChatbotsOptions,
  getAllCoursesOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import { allUserConversationsOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import { manageChatbotRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { QueryResults } from "@/shared-module/components"

import CreateChatbotDialog from "../manage/courses/[id]/other/chatbot/CreateChatbotDialog"
import ChatbotCommandCenter from "./ChatbotCommandCenter"

const ChatbotCommandCenterPage: React.FC = () => {
  const { t } = useTranslation()
  const router = useRouter()

  usePageTitle(t("link-text-chatbot-command-center"))

  const [createChatbotVisible, setCreateChatbotVisible] = useState(false)

  const chatbotsQuery = useQuery({
    ...getAllChatbotsOptions(),
  })

  const coursesQuery = useQuery({
    ...getAllCoursesOptions(),
  })

  const conversationsQuery = useQuery({
    ...allUserConversationsOptions(),
  })

  const closeDialogOpenEdit = (id: string) => {
    setCreateChatbotVisible(false)
    router.push(manageChatbotRoute(id))
  }
  const closeDialog = () => {
    setCreateChatbotVisible(false)
  }

  return (
    <BreakFromCentered sidebar={false}>
      <div
        className={css`
          margin-top: 1rem;
          display: flex;
        `}
      ></div>
      <QueryResults
        treatEmptyAsData
        queries={[chatbotsQuery, coursesQuery, conversationsQuery] as const}
        renderData={([chatbotsData, coursesData, conversationsData]) => (
          <ChatbotCommandCenter
            chatbots={chatbotsData}
            courses={coursesData}
            conversations={conversationsData}
            setCreateChatbotVisible={setCreateChatbotVisible}
          />
        )}
      />
      <CreateChatbotDialog
        courseId={null}
        getChatbotsList={chatbotsQuery}
        open={createChatbotVisible}
        close={closeDialog}
        closeEdit={closeDialogOpenEdit}
      />
    </BreakFromCentered>
  )
}

export default withErrorBoundary(ChatbotCommandCenterPage)
