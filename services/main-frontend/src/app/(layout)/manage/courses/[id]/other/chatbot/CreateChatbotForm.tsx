"use client"

import type { UseQueryResult } from "@tanstack/react-query"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { createChatbotMutation } from "@/generated/api/@tanstack/react-query.generated"
import type { ChatbotConfiguration } from "@/generated/api/types.generated"
import Button from "@/shared-module/common/components/Button"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { omitUndefined } from "@/shared-module/common/utils/nullability"

interface CreateChatbotProps {
  courseId: string | null
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

  const chatbotCreationMutation = useToastMutationOptions(
    createChatbotMutation(),
    {
      notify: true,
      method: "POST",
    },
    {
      onSuccess: (data) => {
        getChatbotsList.refetch()
        closeEdit(data.id)
      },
    },
  )

  return (
    <div>
      <form
        onSubmit={handleSubmit((data) => {
          chatbotCreationMutation.mutate({
            body: { name: data.name.trim(), course_id: courseId },
          })
        })}
      >
        <TextField
          {...omitUndefined({ error: errors.name?.message })}
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
          disabled={chatbotCreationMutation.isPending}
        >
          {t("save")}
        </Button>
      </form>
    </div>
  )
}

export default CreateChatbotForm
