import { css } from "@emotion/css"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { ChatbotConfiguration, NewChatbotConf } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import TextAreaField from "@/shared-module/common/components/InputFields/TextAreaField"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

interface Props {
  onConfigureChatbot: (bot: NewChatbotConf) => void
  onDeleteChatbot: (botId: string, botName: string) => void
  oldChatbotConf: ChatbotConfiguration
}

type ConfigureChatbotFields = Omit<NewChatbotConf, "course_id" | "maintain_azure_search_index">

const itemCss = css`
  flex: 1;
  ${respondToOrLarger.sm} {
    flex: 0 45%;
  }
`
const textFieldCss = css`
  width: auto;
`

const ChatbotConfigurationForm: React.FC<Props> = ({
  onConfigureChatbot,
  onDeleteChatbot,
  oldChatbotConf,
}) => {
  const { t } = useTranslation()
  const {
    register,
    handleSubmit,
    formState: { errors },
    clearErrors,
    setError,
  } = useForm<ConfigureChatbotFields>({
    defaultValues: {
      chatbot_name: oldChatbotConf.chatbot_name,
      enabled_to_students: oldChatbotConf.enabled_to_students,
      prompt: oldChatbotConf.prompt,
      initial_message: oldChatbotConf.initial_message,
      weekly_tokens_per_user: oldChatbotConf.weekly_tokens_per_user,
      daily_tokens_per_user: oldChatbotConf.daily_tokens_per_user,
      temperature: oldChatbotConf.temperature,
      top_p: oldChatbotConf.top_p,
      frequency_penalty: oldChatbotConf.frequency_penalty,
      presence_penalty: oldChatbotConf.presence_penalty,
      response_max_tokens: oldChatbotConf.response_max_tokens,
      use_azure_search: oldChatbotConf.use_azure_search,
      hide_citations: oldChatbotConf.hide_citations,
      use_semantic_reranking: oldChatbotConf.use_semantic_reranking,
    },
  })

  const validateForm = (data: ConfigureChatbotFields): boolean => {
    clearErrors(["frequency_penalty", "presence_penalty", "temperature", "top_p"])
    let isValid = true

    if (data.frequency_penalty > 1 || data.frequency_penalty < 0) {
      setError("frequency_penalty", {
        message: t("error-field-value-between", {
          field: "Frequency penalty",
          lower: "0",
          upper: "1",
        }),
      })
      isValid = false
    }
    if (data.presence_penalty > 1 || data.presence_penalty < 0) {
      setError("presence_penalty", {
        message: t("error-field-value-between", {
          field: "Presence penalty",
          lower: "0",
          upper: "1",
        }),
      })
      isValid = false
    }
    if (data.temperature > 1 || data.temperature < 0) {
      setError("temperature", {
        message: t("error-field-value-between", {
          field: "Temperature",
          lower: "0",
          upper: "1",
        }),
      })
      isValid = false
    }
    if (data.top_p > 1 || data.top_p < 0) {
      setError("top_p", {
        message: t("error-field-value-between", {
          field: "Top p",
          lower: "0",
          upper: "1",
        }),
      })
      isValid = false
    }
    return isValid
  }

  const onConfigureChatbotWrapper = handleSubmit((data) => {
    if (!validateForm(data)) {
      return
    }

    onConfigureChatbot({
      course_id: oldChatbotConf.course_id, // keep the old course id
      chatbot_name: data.chatbot_name,
      enabled_to_students: data.enabled_to_students,
      prompt: data.prompt,
      initial_message: data.initial_message,
      weekly_tokens_per_user: +data.weekly_tokens_per_user,
      daily_tokens_per_user: +data.daily_tokens_per_user,
      temperature: +data.temperature,
      top_p: +data.top_p,
      frequency_penalty: +data.frequency_penalty,
      presence_penalty: +data.presence_penalty,
      response_max_tokens: +data.response_max_tokens,
      use_azure_search: data.use_azure_search,
      // right now use_azure_search requires the next field to be true and there is no need for it to
      // be true if azure search is false, so set them as the same value
      maintain_azure_search_index: data.use_azure_search,
      hide_citations: data.hide_citations,
      use_semantic_reranking: data.use_semantic_reranking,
      default_chatbot: oldChatbotConf.default_chatbot, // keep the old default_chatbot value
    })
  })

  return (
    <div>
      <h2>{t("customize-chatbot")}</h2>
      <form onSubmit={onConfigureChatbotWrapper}>
        <TextField
          id={"name"}
          error={errors.chatbot_name?.message}
          label={t("label-name")}
          {...register("chatbot_name", { required: t("required-field") })}
        />
        <TextAreaField
          className={css`
            flex: 1;
          `}
          label={t("prompt")}
          autoResize={true}
          autoResizeMaxHeightPx={900}
          {...register("prompt")}
        />
        <TextField
          id={"initial-message"}
          label={t("initial-message")}
          {...register("initial_message")}
        />
        <div
          className={css`
            flex-direction: row;
          `}
        >
          <CheckBox label={t("enabled-to-students")} {...register("enabled_to_students")} />
          <CheckBox label={t("hide-citations")} {...register("hide_citations")} />
        </div>

        <h3>{t("advanced-settings")}</h3>

        <div
          className={css`
            margin: 30px 0;
          `}
        >
          <div
            className={css`
              display: flex;
              gap: 20px;
              flex-direction: column;
              margin: 20px 0;
              ${respondToOrLarger.md} {
                flex-direction: row;
                flex-wrap: wrap;
                justify-content: space-between;
              }
            `}
          >
            <div className={itemCss}>
              <h4>{t("configure-tokens")}</h4>
              <TextField
                className={textFieldCss}
                id={"daily-token"}
                type="number"
                label={t("daily-token-user")}
                {...register("daily_tokens_per_user")}
              />
              <TextField
                className={textFieldCss}
                id={"weekly-token"}
                type="number"
                label={t("weekly-token-user")}
                {...register("weekly_tokens_per_user")}
              />
              <TextField
                className={textFieldCss}
                id={"max-tokens"}
                type="number"
                label={t("max-token-response")}
                {...register("response_max_tokens")}
              />
            </div>
            <div className={itemCss}>
              <h4>{t("configure-penalty")}</h4>
              <TextField
                className={textFieldCss}
                id={"freq-penalty"}
                type="number"
                error={errors.frequency_penalty?.message}
                step="0.01"
                label={t("frequency-penalty")}
                {...register("frequency_penalty", { required: t("required-field") })}
              />
              <TextField
                className={textFieldCss}
                id={"pres-penalty"}
                type="number"
                error={errors.presence_penalty?.message}
                step="0.01"
                label={t("presence-penalty")}
                {...register("presence_penalty", { required: t("required-field") })}
              />
            </div>
            <div className={itemCss}>
              <h4>{t("configure-creativity")}</h4>
              <TextField
                className={textFieldCss}
                id={"temperature"}
                type="number"
                error={errors.temperature?.message}
                step="0.01"
                label={t("temperature")}
                {...register("temperature", { required: t("required-field") })}
              />
              <TextField
                className={textFieldCss}
                id={"top-p"}
                type="number"
                error={errors.top_p?.message}
                step="0.01"
                label={t("top-p")}
                {...register("top_p", { required: t("required-field") })}
              />
            </div>
            <div className={itemCss}>
              <h4>{t("configure-search")}</h4>
              <div
                className={css`
                  margin: 20px 20px;
                `}
              >
                <CheckBox label={t("use-azure-search")} {...register("use_azure_search")} />
                <CheckBox
                  label={t("use-semantic-reranking")}
                  {...register("use_semantic_reranking")}
                />
              </div>
            </div>
          </div>
        </div>

        <div>
          <Button type="submit" size="medium" variant="primary">
            {t("save")}
          </Button>
          <Button
            type="button"
            size="medium"
            variant="tertiary"
            onClick={() => onDeleteChatbot(oldChatbotConf.id, oldChatbotConf.chatbot_name)}
          >
            {t("delete")}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default ChatbotConfigurationForm
