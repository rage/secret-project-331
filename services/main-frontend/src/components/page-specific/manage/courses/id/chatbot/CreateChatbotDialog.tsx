import { UseQueryResult } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import CreateChatbotForm from "./CreateChatbotForm"

import { createChatbot } from "@/services/backend/courses/chatbots"
import { ChatbotConfiguration } from "@/shared-module/common/bindings"
import StandardDialog from "@/shared-module/common/components/StandardDialog"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"

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
  const createChatbotMutation = useToastMutation(
    async (botName: string) => await createChatbot(courseId, botName),
    {
      notify: true,
      method: "POST",
      successMessage: t("default-toast-success-message"),
    },
    {
      onSuccess: async (data) => {
        getChatbotsList.refetch()
        closeEdit(data.id)
      },
    },
  )
  const onClose = () => {
    createChatbotMutation.reset()
    close()
  }

  return (
    <StandardDialog open={open} onClose={onClose} title={t("create-chatbot")}>
      <CreateChatbotForm
        onCreateNewChatbot={(newChatbot) => {
          createChatbotMutation.mutate(newChatbot)
        }}
      />
    </StandardDialog>
  )
}

export default CreateChatbotDialog
