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
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import { manageChatbotRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { QueryResults, Button } from "@/shared-module/components"

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

  const closeDialogOpenEdit = (id: string) => {
    setCreateChatbotVisible(false)
    console.log("NEW CHATBOT ID", id)
    router.push(manageChatbotRoute(id))
  }
  const closeDialog = () => {
    setCreateChatbotVisible(false)
  }
  console.log("CREATE CHATBOT VISIBLE", createChatbotVisible)

  return (
    <>
      <div
        className={css`
          display: flex;
        `}
      >
        <h1>{t("link-text-chatbot-command-center")}</h1>
        <div
          className={css`
            margin-left: auto;
            padding: 1.5rem;
          `}
        >
          <Button
            size="medium"
            // variant="secondary"
            onClick={() => {
              setCreateChatbotVisible(true)
            }}
          >
            {t("create-global-chatbot")}
          </Button>
        </div>
      </div>
      <QueryResults
        queries={[chatbotsQuery, coursesQuery] as const}
        renderData={([chatbotsData, coursesData]) => (
          <ChatbotCommandCenter chatbots={chatbotsData} courses={coursesData} />
        )}
      />
      <CreateChatbotDialog
        courseId={null}
        getChatbotsList={chatbotsQuery}
        open={createChatbotVisible}
        close={closeDialog}
        closeEdit={closeDialogOpenEdit}
      />
    </>
  )
}

export default withErrorBoundary(ChatbotCommandCenterPage)
