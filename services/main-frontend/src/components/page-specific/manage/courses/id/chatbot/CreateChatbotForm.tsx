import { UseQueryResult } from "@tanstack/react-query"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { createChatbot } from "@/services/backend/courses/chatbots"
import { ChatbotConfiguration } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"

interface CreateChatbotProps {
  courseId: string
  getChatbotsList: UseQueryResult<ChatbotConfiguration[], unknown>
  closeEdit: (url_id: string) => void
}

interface CreateChatbotFields {
  name: string
}

const CreateChatbotForm: React.FC<CreateChatbotProps> = ({
  courseId,
  getChatbotsList,
  closeEdit,
}) => {
  const { t } = useTranslation()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateChatbotFields>()

  const createChatbotMutation = useToastMutation(
    async (botName: string) => await createChatbot(courseId, botName),
    {
      notify: true,
      method: "POST",
    },
    {
      onSuccess: async (data) => {
        getChatbotsList.refetch()
        closeEdit(data.id)
      },
    },
  )

  return (
    <div>
      <form
        onSubmit={handleSubmit((data) => {
          createChatbotMutation.mutate(data.name.trim())
        })}
      >
        <TextField
          error={errors.name?.message}
          label={t("label-name")}
          {...register("name", {
            required: t("required-field"),
            validate: {
              check: (name) => {
                return name.trim() ? true : t("name-not-empty")
              },
            },
          })}
        />
        <Button
          type="submit"
          size="medium"
          variant="primary"
          disabled={createChatbotMutation.isPending}
        >
          {t("save")}
        </Button>
      </form>
    </div>
  )
}

export default CreateChatbotForm
