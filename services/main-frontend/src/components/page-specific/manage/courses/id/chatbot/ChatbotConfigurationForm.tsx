/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/router"
import React, { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { getChatbotModels } from "@/services/backend/chatbotModels"
import { configureChatbot, deleteChatbot } from "@/services/backend/chatbots"
import {
  ChatbotConfiguration,
  ChatbotConfigurationModel,
  NewChatbotConf,
} from "@/shared-module/common/bindings"
import Accordion from "@/shared-module/common/components/Accordion"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import TextAreaField from "@/shared-module/common/components/InputFields/TextAreaField"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import SelectMenu from "@/shared-module/common/components/SelectMenu"
import Spinner from "@/shared-module/common/components/Spinner"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"
import { courseChatbotSettingsRoute } from "@/shared-module/common/utils/routes"

interface Props {
  oldChatbotConf: ChatbotConfiguration
  chatbotQueryRefetch: () => void
}

type ConfigureChatbotFields = Omit<
  NewChatbotConf,
  "course_id" | "maintain_azure_search_index" | "chatbotconf_id"
>

const itemCss = css`
  flex: 1;
  ${respondToOrLarger.sm} {
    flex: 0 45%;
  }
`
const textFieldCss = css`
  width: auto;
`

const ChatbotConfigurationForm: React.FC<Props> = ({ oldChatbotConf, chatbotQueryRefetch }) => {
  const { t } = useTranslation()
  const router = useRouter()
  const { confirm } = useDialog()
  const [selectedModel, setSelectedModel] = useState<null | ChatbotConfigurationModel>(null)
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ConfigureChatbotFields>({
    defaultValues: {
      chatbot_name: oldChatbotConf.chatbot_name,
      model: oldChatbotConf.model,
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
      verbosity: oldChatbotConf.verbosity,
      reasoning_effort: oldChatbotConf.reasoning_effort,
      thinking_model: oldChatbotConf.thinking_model,
      max_completion_tokens: oldChatbotConf.max_completion_tokens,
      use_azure_search: oldChatbotConf.use_azure_search,
      hide_citations: oldChatbotConf.hide_citations,
      use_semantic_reranking: oldChatbotConf.use_semantic_reranking,
    },
  })

  const getChatbotModelsList = useQuery({
    queryKey: ["chatbot-models", oldChatbotConf.course_id],
    queryFn: () => getChatbotModels(assertNotNullOrUndefined(oldChatbotConf.course_id)),
    enabled: !!oldChatbotConf.course_id,
  })

  const modelFieldValue = watch("model")

  useEffect(() => {
    if (getChatbotModelsList.data) {
      setSelectedModel(
        assertNotNullOrUndefined(
          getChatbotModelsList.data.find((m) => {
            return m.id == modelFieldValue
          }),
        ),
      )
    }
  }, [modelFieldValue, getChatbotModelsList.data])

  const configureChatbotMutation = useToastMutation(
    async (bot: NewChatbotConf) => {
      if (oldChatbotConf === null) {
        throw new Error("Chatbot undefined")
      }
      await configureChatbot(assertNotNullOrUndefined(oldChatbotConf.id), bot)
    },
    {
      notify: true,
      method: "POST",
    },
    {
      onSuccess: () => {
        chatbotQueryRefetch()
      },
    },
  )

  const deleteChatbotMutation = useToastMutation(
    async (chatbotConfigurationId: string) => await deleteChatbot(chatbotConfigurationId),
    {
      method: "DELETE",
      notify: true,
    },
    {
      onSuccess: () => {
        router.push(courseChatbotSettingsRoute(assertNotNullOrUndefined(oldChatbotConf.course_id)))
      },
    },
  )

  const onConfigureChatbotWrapper = handleSubmit((data) => {
    let azure_search = assertNotNullOrUndefined(selectedModel?.thinking)
      ? false
      : selectedModel?.model === "model-router"
        ? false
        : data.use_azure_search

    configureChatbotMutation.mutate({
      course_id: oldChatbotConf.course_id, // keep the old course id
      chatbot_name: data.chatbot_name,
      model: data.model,
      enabled_to_students: data.enabled_to_students,
      prompt: data.prompt,
      initial_message: data.initial_message,
      weekly_tokens_per_user: +data.weekly_tokens_per_user,
      daily_tokens_per_user: +data.daily_tokens_per_user,
      temperature: data.temperature,
      top_p: +data.top_p,
      frequency_penalty: +data.frequency_penalty,
      presence_penalty: +data.presence_penalty,
      response_max_tokens: +data.response_max_tokens,
      max_completion_tokens: +data.max_completion_tokens,
      reasoning_effort: data.reasoning_effort,
      verbosity: data.verbosity,
      thinking_model: assertNotNullOrUndefined(selectedModel?.thinking),
      use_azure_search: azure_search,
      // right now use_azure_search requires the next field to be true and there is no need for it to
      // be true if azure search is false, so set them as the same value
      maintain_azure_search_index: azure_search,
      hide_citations: data.hide_citations,
      use_semantic_reranking: data.use_semantic_reranking,
      default_chatbot: oldChatbotConf.default_chatbot, // keep the old default_chatbot value
      chatbotconf_id: null,
    })
  })

  if (getChatbotModelsList.isError) {
    return <ErrorBanner variant={"readOnly"} error={getChatbotModelsList.error} />
  }

  if (getChatbotModelsList.isLoading || getChatbotModelsList.data === undefined) {
    return <Spinner variant={"medium"} />
  }

  return (
    <div>
      <h2>{t("customize-chatbot")}</h2>
      <form onSubmit={onConfigureChatbotWrapper}>
        <TextField
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
        <TextField label={t("initial-message")} {...register("initial_message")} />
        <div
          className={css`
            flex-direction: row;
          `}
        >
          <CheckBox label={t("enabled-to-students")} {...register("enabled_to_students")} />
        </div>
        <SelectMenu
          id="model-select"
          label={t("select-LLM")}
          options={getChatbotModelsList.data.map((m) => {
            return {
              value: m.id,
              label: `${m.model} (${m.thinking ? t("reasoning") : t("non-reasoning")})`,
            }
          })}
          showDefaultOption={false}
          {...register("model")}
        />
        {selectedModel?.thinking ? (
          <div className={itemCss}>
            <h4>{"Configure reasoning"}</h4>
            <div
              className={css`
                margin: 20px 20px;
              `}
            >
              <SelectMenu
                id="verbosity-select"
                label={t("select-verbosity")}
                error={errors.verbosity?.message}
                options={[
                  { value: "low", label: t("low") },
                  { value: "medium", label: t("medium") },
                  { value: "high", label: t("high") },
                ]}
                disabled={!selectedModel?.thinking}
                showDefaultOption={false}
                {...register("verbosity")}
              />
              <SelectMenu
                id="reasoning-effort-select"
                label={t("select-reasoning-effort")}
                error={errors.reasoning_effort?.message}
                options={[
                  { value: "minimal", label: t("minimal") },
                  { value: "low", label: t("low") },
                  { value: "medium", label: t("medium") },
                  { value: "high", label: t("high") },
                ]}
                disabled={!selectedModel?.thinking}
                showDefaultOption={false}
                {...register("reasoning_effort")}
              />
              <TextField
                className={textFieldCss}
                type="number"
                label={t("max-completion-tokens")}
                error={errors.max_completion_tokens?.message}
                disabled={!selectedModel?.thinking}
                {...register("max_completion_tokens", { required: t("required-field") })}
              />
            </div>
          </div>
        ) : (
          selectedModel?.model !== "model-router" && (
            <>
              <CheckBox label={t("use-azure-search")} {...register("use_azure_search")} />
              <CheckBox label={t("hide-citations")} {...register("hide_citations")} />
            </>
          )
        )}
        <Accordion>
          <details
            className={css`
              margin: 20px 0px;
            `}
          >
            <summary>
              <h3>{t("advanced-settings")}</h3>
            </summary>
            <div>
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
                    type="number"
                    label={t("daily-token-user")}
                    {...register("daily_tokens_per_user")}
                  />
                  <TextField
                    className={textFieldCss}
                    type="number"
                    label={t("weekly-token-user")}
                    {...register("weekly_tokens_per_user")}
                  />
                </div>
                <div className={itemCss}>
                  <h4>{t("configure-search")}</h4>
                  <div
                    className={css`
                      margin: 20px 20px;
                    `}
                  >
                    <CheckBox
                      label={t("use-semantic-reranking")}
                      {...register("use_semantic_reranking")}
                    />
                  </div>
                </div>
                <div
                  className={css`
                    flex-direction: column;
                    flex-grow: 1;
                    gap: 20px;
                    justify-content: space-between;
                    margin-right: 20px;
                  `}
                >
                  {!selectedModel?.thinking && (
                    <div>
                      {" "}
                      <div className={itemCss}>
                        <h3>Non-reasoning model settings</h3>
                        <TextField
                          className={textFieldCss}
                          type="number"
                          label={t("max-token-response")}
                          error={errors.response_max_tokens?.message}
                          {...register("response_max_tokens")}
                        />
                        <h4>{t("configure-penalty")}</h4>
                        <TextField
                          className={textFieldCss}
                          type="number"
                          error={errors.frequency_penalty?.message}
                          step="0.01"
                          label={t("frequency-penalty")}
                          disabled={selectedModel?.thinking}
                          {...register("frequency_penalty", {
                            required: t("required-field"),
                            min: {
                              value: 0,
                              message: t("error-field-value-between", {
                                field: t("frequency-penalty"),
                                lower: "0",
                                upper: "1",
                              }),
                            },
                            max: {
                              value: 1,
                              message: t("error-field-value-between", {
                                field: t("frequency-penalty"),
                                lower: "0",
                                upper: "1",
                              }),
                            },
                          })}
                        />
                        <TextField
                          className={textFieldCss}
                          type="number"
                          error={errors.presence_penalty?.message}
                          step="0.01"
                          label={t("presence-penalty")}
                          disabled={selectedModel?.thinking}
                          {...register("presence_penalty", {
                            required: t("required-field"),
                            min: {
                              value: 0,
                              message: t("error-field-value-between", {
                                field: t("presence-penalty"),
                                lower: "0",
                                upper: "1",
                              }),
                            },
                            max: {
                              value: 1,
                              message: t("error-field-value-between", {
                                field: t("presence-penalty"),
                                lower: "0",
                                upper: "1",
                              }),
                            },
                          })}
                        />
                      </div>
                      <div className={itemCss}>
                        <h4>{t("configure-creativity")}</h4>
                        <TextField
                          className={textFieldCss}
                          type="number"
                          error={errors.temperature?.message}
                          step="0.01"
                          label={t("temperature")}
                          disabled={selectedModel?.thinking}
                          {...register("temperature", {
                            required: t("required-field"),
                            min: {
                              value: 0,
                              message: t("error-field-value-between", {
                                field: t("temperature"),
                                lower: "0",
                                upper: "1",
                              }),
                            },
                            max: {
                              value: 1,
                              message: t("error-field-value-between", {
                                field: t("temperature"),
                                lower: "0",
                                upper: "1",
                              }),
                            },
                          })}
                        />
                        <TextField
                          className={textFieldCss}
                          type="number"
                          error={errors.top_p?.message}
                          step="0.01"
                          label={t("top-p")}
                          disabled={selectedModel?.thinking}
                          {...register("top_p", {
                            required: t("required-field"),
                            min: {
                              value: 0,
                              message: t("error-field-value-between", {
                                field: t("top-p"),
                                lower: "0",
                                upper: "1",
                              }),
                            },
                            max: {
                              value: 1,
                              message: t("error-field-value-between", {
                                field: t("top-p"),
                                lower: "0",
                                upper: "1",
                              }),
                            },
                          })}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div
                  className={css`
                    flex-direction: column;
                    flex-grow: 1;
                    margin-left: 20px;
                  `}
                ></div>
              </div>
            </div>
          </details>
        </Accordion>

        <div>
          <Button
            type="submit"
            size="medium"
            variant="primary"
            disabled={configureChatbotMutation.isPending}
          >
            {t("save")}
          </Button>
          <Button
            type="button"
            size="medium"
            variant="tertiary"
            disabled={deleteChatbotMutation.isPending}
            onClick={async () => {
              if (
                await confirm(
                  t("delete-chatbot-confirmation", { name: oldChatbotConf.chatbot_name }),
                )
              ) {
                deleteChatbotMutation.mutate(oldChatbotConf.id)
              }
            }}
          >
            {t("delete")}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default ChatbotConfigurationForm
