import { css } from "@emotion/css"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { ChatbotConfiguration, NewChatbotConf } from "@/shared-module/common/bindings"
import Accordion from "@/shared-module/common/components/Accordion"
import Button from "@/shared-module/common/components/Button"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import TextAreaField from "@/shared-module/common/components/InputFields/TextAreaField"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

interface Props {
  onConfigureChatbot: (bot: NewChatbotConf) => void
  onCancel: () => void
  oldChatbotConf: ChatbotConfiguration
}

interface ConfigureChatbotFields {
  name: string
  prompt: string
  initialMessage: string
  enabledStudents: boolean
  hideCitations: boolean
  dailyTokenUser: number
  weeklyTokenUser: number
  maxTokens: number
  freqPenalty: number
  presPenalty: number
  temperature: number
  topP: number
  azureSearch: boolean
  semanticReranking: boolean
  defaultChatbot: boolean
}

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
  onCancel,
  oldChatbotConf,
}) => {
  const { t } = useTranslation()
  const {
    register,
    handleSubmit,
    formState: { errors },
    clearErrors,
    watch,
    setError,
  } = useForm<ConfigureChatbotFields>()

  const validateForm = (data: ConfigureChatbotFields): boolean => {
    let isValid = true
    /* clearErrors([""])

    if (data.name.length < 1) {
      setError("", {
        message: t("error-min-length", { count: 1, field: t("text-field-label-name") }),
      })
      isValid = false
    } */
    return isValid
  }

  const onConfigureChatbotWrapper = handleSubmit((data) => {
    if (!validateForm(data)) {
      return
    }
    console.log(oldChatbotConf)
    console.log(data)
    onConfigureChatbot({
      chatbot_name: data.name,
      enabled_to_students: data.enabledStudents,
      prompt: data.prompt,
      initial_message: data.initialMessage,
      weekly_tokens_per_user: +data.weeklyTokenUser,
      daily_tokens_per_user: +data.dailyTokenUser,
      temperature: +data.temperature,
      top_p: +data.topP,
      frequency_penalty: +data.freqPenalty,
      presence_penalty: +data.presPenalty,
      response_max_tokens: +data.maxTokens,
      use_azure_search: data.azureSearch,
      hide_citations: data.hideCitations,
      use_semantic_reranking: data.semanticReranking,
      default_chatbot: data.defaultChatbot,
    })
  })

  return (
    <div>
      <h2>{t("customize-chatbot")}</h2>
      <form onSubmit={onConfigureChatbotWrapper}>
        <TextField
          id={"name"}
          error={errors.name?.message}
          defaultValue={oldChatbotConf.chatbot_name}
          label={t("label-name")}
          {...register("name", { required: t("required-field") })}
        />
        <TextAreaField
          className={css`
            flex: 1;
          `}
          label={t("prompt")}
          defaultValue={oldChatbotConf.prompt}
          {...register("prompt")}
        />
        <TextField
          id={"initial-message"}
          label={t("initial-message")}
          defaultValue={oldChatbotConf.initial_message}
          {...register("initialMessage")}
        />
        <div
          // css?
          className={css`
            flex-direction: row;
          `}
        >
          <CheckBox
            label={t("enabled-to-students")}
            defaultChecked={oldChatbotConf.enabled_to_students}
            {...register("enabledStudents")}
          />
          <CheckBox
            label={t("hide-citations")}
            defaultChecked={oldChatbotConf.hide_citations}
            {...register("hideCitations")}
          />
          <CheckBox
            label={t("set-default-chatbot")}
            defaultChecked={oldChatbotConf.default_chatbot}
            {...register("defaultChatbot")}
          />
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
                defaultValue={oldChatbotConf.daily_tokens_per_user}
                label={t("daily-token-user")}
                {...register("dailyTokenUser")}
              />
              <TextField
                className={textFieldCss}
                id={"weekly-token"}
                type="number"
                defaultValue={oldChatbotConf.weekly_tokens_per_user}
                label={t("weekly-token-user")}
                {...register("weeklyTokenUser")}
              />
              <TextField
                className={textFieldCss}
                id={"max-tokens"}
                type="number"
                defaultValue={oldChatbotConf.response_max_tokens}
                label={t("max-token-response")}
                {...register("maxTokens")}
              />
            </div>
            <div className={itemCss}>
              <h4>{t("configure-penalty")}</h4>
              <TextField
                className={textFieldCss}
                id={"freq-penalty"}
                type="number"
                defaultValue={oldChatbotConf.frequency_penalty}
                label={t("frequency-penalty")}
                {...register("freqPenalty")}
              />
              <TextField
                className={textFieldCss}
                id={"pres-penalty"}
                type="number"
                defaultValue={oldChatbotConf.presence_penalty}
                label={t("presence-penalty")}
                {...register("presPenalty")}
              />
            </div>
            <div className={itemCss}>
              <h4>{t("configure-creativity")}</h4>
              <TextField
                className={textFieldCss}
                id={"temperature"}
                type="number"
                defaultValue={oldChatbotConf.temperature}
                label={t("temperature")}
                {...register("temperature")}
              />
              <TextField
                className={textFieldCss}
                id={"top-p"}
                type="number"
                defaultValue={oldChatbotConf.top_p}
                label={t("top-p")}
                {...register("topP")}
              />
            </div>
            <div className={itemCss}>
              <h4>{t("search-configuration")}</h4>
              <div
                className={css`
                  margin: 20px 20px;
                `}
              >
                <CheckBox
                  label={t("use-azure-search")}
                  defaultChecked={oldChatbotConf.use_azure_search}
                  {...register("azureSearch")}
                />
                <CheckBox
                  label={t("use-semantic-reranking")}
                  defaultChecked={oldChatbotConf.use_semantic_reranking}
                  {...register("semanticReranking")}
                />
              </div>
            </div>
          </div>
        </div>

        <Button type="submit" size="medium" variant="primary">
          {t("save")}
        </Button>
        <Button type="button" size="medium" variant="secondary" onClick={onCancel}>
          {t("button-text-cancel")}
        </Button>
      </form>
    </div>
  )
}

export default ChatbotConfigurationForm
