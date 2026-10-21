"use client"

import type { UseQueryResult } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import type { ChatbotConfiguration } from "@/generated/api/types.generated"
import { Dialog } from "@/shared-module/components"

import CreateChatbotForm from "./CreateChatbotForm"

interface CreateChatbotDialogProps {
  courseId: string | null
  getChatbotsList: UseQueryResult<ChatbotConfiguration[], unknown>
  open: boolean
  close: () => void
  closeEdit: (url_id: string) => void
}

const CreateChatbotDialog: React.FC<React.PropsWithChildren<CreateChatbotDialogProps>> = ({
  courseId,
  getChatbotsList,
  open,
  close,
  closeEdit,
}) => {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onClose={close} title={t("create-chatbot")}>
      <CreateChatbotForm
        courseId={courseId}
        getChatbotsList={getChatbotsList}
        closeEdit={closeEdit}
      />
    </Dialog>
  )
}

export default CreateChatbotDialog
