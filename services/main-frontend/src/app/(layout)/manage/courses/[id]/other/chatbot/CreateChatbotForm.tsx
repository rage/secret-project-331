"use client"

import type { UseQueryResult } from "@tanstack/react-query"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { createChatbotMutation } from "@/generated/api/@tanstack/react-query.generated"
import type { ChatbotConfiguration } from "@/generated/api/types.generated"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { Button, TextArea, TextField } from "@/shared-module/components"

import { itemsContainerCss } from "./styles"

interface CreateChatbotProps {
  courseId: string | null
  getChatbotsList: UseQueryResult<ChatbotConfiguration[], unknown>
  closeEdit: (url_id: string) => void
}

interface CreateChatbotFields {
  name: string
  purpose: string
}

const CreateChatbotForm: React.FC<CreateChatbotProps> = ({
  courseId,
  getChatbotsList,
  closeEdit,
}) => {
  const { t } = useTranslation()
  const { confirm } = useDialog()
  const { control, handleSubmit } = useForm<CreateChatbotFields>()

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
      onError: async (error, variables) => {
        const try_again = await confirm(
          <>
            <p>{t("create-chatbot-form-fail-dialog")}</p>
            <ErrorBanner error={error} />
          </>,
          t("create-chatbot-form-fail-title"),
        )
        chatbotCreationMutation.mutate({
          body: { ...variables.body, skip_azure_stuff: !try_again },
        })
      },
    },
  )

  return (
    <div>
      <form
        className={itemsContainerCss}
        onSubmit={handleSubmit((data) => {
          chatbotCreationMutation.mutate({
            body: {
              name: data.name.trim(),
              course_id: courseId,
              purpose: data.purpose.trim(),
              skip_azure_stuff: false,
            },
          })
        })}
      >
        <TextField
          control={control}
          label={t("label-name")}
          isRequired
          name={"name"}
          rules={{
            validate: {
              check: (name) => {
                return name.trim() ? true : t("name-not-empty")
              },
            },
            required: t("required-field"),
          }}
        />
        <TextArea
          control={control}
          autoResize={true}
          label={t("label-purpose")}
          isRequired
          name={"purpose"}
          rules={{
            validate: {
              check: (purpose) => {
                return purpose.trim() ? true : t("field-cannot-be-empty")
              },
            },
            required: t("required-field"),
          }}
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
