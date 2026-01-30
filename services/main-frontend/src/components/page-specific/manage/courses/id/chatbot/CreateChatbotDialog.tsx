"use client"

import { UseQueryResult } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import CreateChatbotForm from "./CreateChatbotForm"

import { ChatbotConfiguration } from "@/shared-module/common/bindings"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"

interface CreateChatbotDialogProps {
  courseId: string
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
    <StandardDialog open={open} onClose={close} title={t("create-chatbot")}>
      <CreateChatbotForm
        courseId={courseId}
        getChatbotsList={getChatbotsList}
        closeEdit={closeEdit}
      />
    </StandardDialog>
  )
}

export default CreateChatbotDialog
