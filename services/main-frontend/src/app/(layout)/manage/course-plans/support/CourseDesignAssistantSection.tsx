"use client"

import { css } from "@emotion/css"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  getCourseDesignerSupportAssistantChatbotsOptions,
  getCourseDesignerSupportAssistantChatbotsQueryKey,
  setChatbotCourseDesignerAssistantMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import type { CourseChatbotOption } from "@/generated/api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"
import { courseChatbotSettingsRoute } from "@/shared-module/common/utils/routes"
import {
  Button,
  DescriptionList,
  EmptyState,
  getErrorMessage,
  Link,
  QueryResult,
  Select,
} from "@/shared-module/components"

const sectionStyles = css`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin: 2.5rem 0 0;
  max-width: 48rem;

  h2 {
    margin: 0;
    font-size: 1.25rem;
  }
`

const descriptionStyles = css`
  margin: 0;
  color: ${baseTheme.colors.gray[600]};
`

const formStyles = css`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`

const actionRowStyles = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
`

const feedbackStyles = css`
  margin: 0;
  font-size: 0.85rem;
  color: ${baseTheme.colors.gray[600]};
`

const errorStyles = css`
  margin: 0;
  font-size: 0.85rem;
  color: ${baseTheme.colors.red[700]};
`

/** Shows and changes which course chatbot answers on every course design plan page. */
export default function CourseDesignAssistantSection() {
  const { t } = useTranslation()
  const chatbotsQuery = useQuery(getCourseDesignerSupportAssistantChatbotsOptions())

  return (
    <section className={sectionStyles} aria-labelledby="course-design-assistant-heading">
      <h2 id="course-design-assistant-heading">{t("course-plans-support-assistant-heading")}</h2>
      <p className={descriptionStyles}>{t("course-plans-support-assistant-description")}</p>
      <QueryResult
        query={chatbotsQuery}
        emptyFallback={
          <EmptyState
            title={t("course-plans-support-assistant-no-chatbots")}
            hint={t("course-plans-support-assistant-none")}
          />
        }
      >
        {(chatbots) => <AssistantChoice chatbots={chatbots} />}
      </QueryResult>
    </section>
  )
}

interface AssistantChoiceFormValues {
  chatbotId: string
}

function AssistantChoice({ chatbots }: { chatbots: CourseChatbotOption[] }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const assistant = chatbots.find((chatbot) => chatbot.course_designer_assistant)
  const [savedJustNow, setSavedJustNow] = useState(false)

  const { control, handleSubmit, reset, formState } = useForm<AssistantChoiceFormValues>({
    defaultValues: { chatbotId: assistant?.id ?? "" },
  })
  const chatbotId = useWatch({ control, name: "chatbotId" })

  useEffect(() => {
    reset({ chatbotId: assistant?.id ?? "" })
  }, [assistant?.id, reset])

  useEffect(() => {
    if (formState.isDirty) {
      setSavedJustNow(false)
    }
  }, [formState.isDirty])

  const mutation = useMutation({
    ...setChatbotCourseDesignerAssistantMutation(),
    onSuccess: async () => {
      setSavedJustNow(true)
      await queryClient.invalidateQueries({
        queryKey: getCourseDesignerSupportAssistantChatbotsQueryKey(),
      })
    },
  })

  const setAssistant = (chatbotConfigurationId: string, isAssistant: boolean) => {
    mutation.mutate({
      path: { chatbot_configuration_id: chatbotConfigurationId },
      body: { course_designer_assistant: isAssistant },
    })
  }

  const onSubmit = (values: AssistantChoiceFormValues) => {
    if (values.chatbotId !== "") {
      setAssistant(values.chatbotId, true)
    }
  }

  return (
    <form className={formStyles} onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
      {assistant ? (
        <DescriptionList
          items={[
            { label: t("course-plans-support-assistant-chatbot"), value: assistant.chatbot_name },
            {
              label: t("course-plans-support-assistant-guide-course"),
              value: (
                <Link href={courseChatbotSettingsRoute(assistant.course_id)}>
                  {assistant.course_name}
                </Link>
              ),
            },
          ]}
        />
      ) : (
        <p className={descriptionStyles}>{t("course-plans-support-assistant-none")}</p>
      )}
      <Select
        id="course-design-assistant-chatbot"
        name="chatbotId"
        control={control}
        label={t("course-plans-support-assistant-select-label")}
        placeholder={t("course-plans-support-assistant-select-placeholder")}
        searchEnabled
        options={chatbots.map((chatbot) => ({
          value: chatbot.id,
          label: t("course-plans-support-assistant-option", {
            course: chatbot.course_name,
            chatbot: chatbot.chatbot_name,
          }),
        }))}
      />
      <div className={actionRowStyles}>
        <Button
          type="submit"
          variant="primary"
          size="medium"
          disabled={chatbotId === "" || chatbotId === assistant?.id}
          isLoading={mutation.isPending && mutation.variables.body.course_designer_assistant}
        >
          {t("course-plans-support-assistant-save")}
        </Button>
        {assistant && (
          <Button
            type="button"
            variant="secondary"
            size="medium"
            onClick={() => setAssistant(assistant.id, false)}
            disabled={mutation.isPending}
            isLoading={mutation.isPending && !mutation.variables.body.course_designer_assistant}
          >
            {t("course-plans-support-assistant-remove")}
          </Button>
        )}
        {mutation.isError ? (
          <p className={errorStyles} role="alert">
            {t("course-plans-support-assistant-save-error", {
              message: getErrorMessage(mutation.error),
            })}
          </p>
        ) : savedJustNow && !formState.isDirty ? (
          <p className={feedbackStyles} role="status">
            {t("course-plans-support-assistant-saved")}
          </p>
        ) : null}
      </div>
    </form>
  )
}
