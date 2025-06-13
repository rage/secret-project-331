import { UseQueryResult } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import CreateChatbotForm from "./CreateChatbotForm"

import { createChatbot } from "@/services/backend/courses/chatbots"
import { ChatbotConfiguration, NewChatbotConf } from "@/shared-module/common/bindings"
import StandardDialog from "@/shared-module/common/components/StandardDialog"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"

interface CreateChatbotDialogProps {
  courseId: string
  getChatbotsList: UseQueryResult<ChatbotConfiguration[], unknown>
  open: boolean
  close: (url_id: string) => void
}

const CreateChatbotDialog: React.FC<React.PropsWithChildren<CreateChatbotDialogProps>> = ({
  courseId,
  getChatbotsList,
  open,
  close,
}) => {
  const { t } = useTranslation()
  const createChatbotMutation = useToastMutation(
    async (bot: NewChatbotConf) => await createChatbot(courseId, bot),
    {
      notify: true,
      method: "POST",
      successMessage: t("default-toast-success-message"),
    },
    {
      onSuccess: async (data) => {
        getChatbotsList.refetch()
        close(data.id)
      },
    },
  )
  const onClose = () => {
    createChatbotMutation.reset()
    //close()
  }

  return (
    /* eslint-disable i18next/no-literal-string */
    <StandardDialog open={open} onClose={onClose} title={"test"}>
      <CreateChatbotForm
        courseId={courseId}
        chatbotName={null}
        onCreateNewChatbot={(newChatbot) => {
          createChatbotMutation.mutate(newChatbot)
        }}
      />
    </StandardDialog>
  )
}

export default CreateChatbotDialog
