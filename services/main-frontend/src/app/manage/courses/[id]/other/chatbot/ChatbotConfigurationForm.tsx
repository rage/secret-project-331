"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import React, { useState } from "react"
import { useFieldArray, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import ChatbotPreviewModal from "./ChatbotPreviewModal"

import {
  configureChatbotMutation as configureChatbotMutationOptions,
  deleteChatbotConfigurationMutation as deleteChatbotMutationOptions,
  getChatbotModelsOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import type {
  ChatbotConfiguration,
  NewChatbotConf,
  ReasoningEffortLevel,
  VerbosityLevel,
} from "@/generated/api/types.generated"
import Accordion from "@/shared-module/common/components/Accordion"
import Button from "@/shared-module/common/components/Button"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import TextAreaField from "@/shared-module/common/components/InputFields/TextAreaField"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import SelectMenu from "@/shared-module/common/components/SelectMenu"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"
import { courseChatbotSettingsRoute } from "@/shared-module/common/utils/routes"
import { QueryResult } from "@/shared-module/components"

interface Props {
  oldChatbotConf: ChatbotConfiguration
  chatbotQueryRefetch: () => void
}

interface Message {
  message: string
}

type ConfigureChatbotFields = Omit<
  NewChatbotConf,
  "course_id" | "maintain_azure_search_index" | "chatbotconf_id"
> & { suggested_messages: Message[] }

const itemCss = css`
  flex: 1;
  ${respondToOrLarger.sm} {
    flex: 0 45%;
  }
`
const textFieldCss = css`
  width: auto;
`

const NONE = "none"
const MINIMAL = "minimal"
const LOW = "low"
const MEDIUM = "medium"
const HIGH = "high"
const XHIGH = "xhigh"

// Minimum max_output_tokens accepted by the backend (see MIN_MAX_OUTPUT_TOKENS in
// chatbot_configurations.rs and the DB CHECK constraint).
const MIN_OUTPUT_TOKENS = 10000

const ChatbotConfigurationForm: React.FC<Props> = ({ oldChatbotConf, chatbotQueryRefetch }) => {
  const { t } = useTranslation()
  const router = useRouter()
  const { confirm } = useDialog()
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ConfigureChatbotFields>({
    defaultValues: {
      chatbot_name: oldChatbotConf.chatbot_name,
      model_id: oldChatbotConf.model_id,
      enabled_to_students: oldChatbotConf.enabled_to_students,
      prompt: oldChatbotConf.prompt,
      initial_message: oldChatbotConf.initial_message,
      weekly_tokens_per_user: oldChatbotConf.weekly_tokens_per_user,
      daily_tokens_per_user: oldChatbotConf.daily_tokens_per_user,
      temperature: oldChatbotConf.temperature,
      top_p: oldChatbotConf.top_p,
      frequency_penalty: oldChatbotConf.frequency_penalty,
      presence_penalty: oldChatbotConf.presence_penalty,
      max_output_tokens: oldChatbotConf.max_output_tokens,
      verbosity: oldChatbotConf.verbosity,
      reasoning_effort: oldChatbotConf.reasoning_effort,
      use_azure_search: oldChatbotConf.use_azure_search,
      use_tools: oldChatbotConf.use_tools,
      hide_citations: oldChatbotConf.hide_citations,
      use_semantic_reranking: oldChatbotConf.use_semantic_reranking,
      suggest_next_messages: oldChatbotConf.suggest_next_messages,
      initial_suggested_messages: oldChatbotConf.initial_suggested_messages,
      suggested_messages: oldChatbotConf.initial_suggested_messages?.map((v) => ({
        message: v,
      })),
    },
  })

  const [showChatbotPreview, setChatbotPreview] = useState(false)

  // eslint-disable-next-line i18next/no-literal-string
  const { fields, append, remove } = useFieldArray({ control, name: "suggested_messages" })

  const getChatbotModelsList = useQuery({
    ...getChatbotModelsOptions({
      query: {
        course_id: assertNotNullOrUndefined(oldChatbotConf.course_id),
      },
    }),
    enabled: !!oldChatbotConf.course_id,
  })

  const modelFieldValue = watch("model_id")
  const suggestMessagesFieldValue = watch("suggest_next_messages")

  const configureChatbotMutation = useToastMutationOptions(
    configureChatbotMutationOptions(),
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

  const deleteChatbotMutation = useToastMutationOptions(
    deleteChatbotMutationOptions(),
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
    configureChatbotMutation.mutate({
      body: {
        course_id: oldChatbotConf.course_id, // keep the old course id
        chatbot_name: data.chatbot_name,
        model_id: data.model_id,
        enabled_to_students: data.enabled_to_students,
        prompt: data.prompt,
        initial_message: data.initial_message,
        weekly_tokens_per_user: +data.weekly_tokens_per_user,
        daily_tokens_per_user: +data.daily_tokens_per_user,
        temperature: +data.temperature,
        top_p: +data.top_p,
        frequency_penalty: +data.frequency_penalty,
        presence_penalty: +data.presence_penalty,
        max_output_tokens: +data.max_output_tokens,
        reasoning_effort: data.reasoning_effort,
        verbosity: data.verbosity,
        use_azure_search: data.use_azure_search,
        // right now use_azure_search requires the next field to be true and there is no need for it to
        // be true if azure search is false, so set them as the same value
        maintain_azure_search_index: data.use_azure_search,
        hide_citations: data.hide_citations,
        use_semantic_reranking: data.use_semantic_reranking,
        use_tools: data.use_tools,
        suggest_next_messages: data.suggest_next_messages,
        initial_suggested_messages: data.suggested_messages.map((v) => v.message),
        default_chatbot: oldChatbotConf.default_chatbot, // keep the old default_chatbot value
        chatbotconf_id: null,
      },
      path: {
        chatbot_configuration_id: assertNotNullOrUndefined(oldChatbotConf.id),
      },
    })
  })

  return (
    <QueryResult query={getChatbotModelsList}>
      {(chatbotModels) => {
        // The selected model might no longer be present in the list (e.g. stale config),
        // so look it up safely and degrade gracefully instead of crashing the form.
        const selectedModel = chatbotModels.find((m) => {
          return m.id === modelFieldValue
        })
        const selectedModelThinking = selectedModel
          ? ["GPTThinking", "GPTHardThinking"].includes(selectedModel.model_type)
          : false

        return (
          <div>
            <h2>{t("customize-chatbot")}</h2>
            <form onSubmit={onConfigureChatbotWrapper}>
              <TextField
                required
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
              <TextField required label={t("initial-message")} {...register("initial_message")} />
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
                options={chatbotModels.map((m) => {
                  return {
                    value: m.id,
                    label: `${m.model} (${["GPTThinking", "GPTHardThinking"].includes(m.model_type) ? t("reasoning") : t("non-reasoning")})`,
                  }
                })}
                showDefaultOption={false}
                {...register("model_id")}
              />
              <CheckBox label={t("use-azure-search")} {...register("use_azure_search")} />
              <CheckBox label={t("hide-citations")} {...register("hide_citations")} />
              <CheckBox label={t("enable-tool-use")} {...register("use_tools")} />
              <CheckBox label={t("suggest-next-messages")} {...register("suggest_next_messages")} />
              {suggestMessagesFieldValue && (
                <div className={itemCss}>
                  <h4>{t("message-suggestions")}</h4>
                  <div
                    className={css`
                      margin: 20px 20px;
                    `}
                  >
                    {fields.map((item, idx) => (
                      <div
                        key={item.id}
                        className={css`
                          display: flex;
                          flex-flow: row nowrap;
                          margin: 10px 0;
                        `}
                      >
                        <TextField
                          className={css`
                            flex-grow: 3;
                          `}
                          key={item.id}
                          error={errors.suggested_messages?.[idx]?.message}
                          label={t("label-message")}
                          {...register(`suggested_messages.${idx}.message` as const, {
                            required: t("required-field"),
                          })}
                        />
                        <Button
                          className={css`
                            height: fit-content;
                            margin: 1.7rem 0 0 0.5rem;
                          `}
                          size="small"
                          type="button"
                          variant="tertiary"
                          onClick={() => remove(idx)}
                        >
                          {t("button-remove")}
                        </Button>
                      </div>
                    ))}
                    <Button
                      size="medium"
                      type="button"
                      variant="secondary"
                      onClick={() => append({ message: "" })}
                    >
                      {t("add-new-message")}
                    </Button>
                  </div>
                </div>
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
                        <TextField
                          className={textFieldCss}
                          type="number"
                          label={
                            selectedModelThinking
                              ? t("max-completion-tokens")
                              : t("max-token-response")
                          }
                          error={errors.max_output_tokens?.message}
                          {...register("max_output_tokens", {
                            required: t("required-field"),
                            min: {
                              value: MIN_OUTPUT_TOKENS,
                              message: t("error-field-value-at-least", {
                                field: selectedModelThinking
                                  ? t("max-completion-tokens")
                                  : t("max-token-response"),
                                lower: String(MIN_OUTPUT_TOKENS),
                              }),
                            },
                          })}
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
                        {selectedModelThinking ? (
                          <div className={itemCss}>
                            <h4>{t("configure-reasoning")}</h4>
                            <div
                              className={css`
                                margin: 20px 20px;
                              `}
                            >
                              <SelectMenu<VerbosityLevel>
                                id="verbosity-select"
                                label={t("select-verbosity")}
                                error={errors.verbosity?.message}
                                options={[
                                  { value: LOW, label: t("reasoning-effort-low") },
                                  { value: MEDIUM, label: t("reasoning-effort-medium") },
                                  { value: HIGH, label: t("reasoning-effort-high") },
                                ]}
                                disabled={!selectedModelThinking}
                                showDefaultOption={false}
                                {...register("verbosity")}
                              />
                              <SelectMenu<ReasoningEffortLevel>
                                id="reasoning-effort-select"
                                label={t("select-reasoning-effort")}
                                error={errors.reasoning_effort?.message}
                                options={[
                                  { value: NONE, label: t("reasoning-effort-none") },
                                  { value: MINIMAL, label: t("reasoning-effort-minimal") },
                                  { value: LOW, label: t("reasoning-effort-low") },
                                  { value: MEDIUM, label: t("reasoning-effort-medium") },
                                  { value: HIGH, label: t("reasoning-effort-high") },
                                  { value: XHIGH, label: t("reasoning-effort-xhigh") },
                                ]}
                                disabled={!selectedModelThinking}
                                showDefaultOption={false}
                                {...register("reasoning_effort")}
                              />
                            </div>
                          </div>
                        ) : (
                          <div>
                            {" "}
                            <div className={itemCss}>
                              <h3>{t("non-reasoning-model-settings")}</h3>
                              <h4>{t("configure-penalty")}</h4>
                              <TextField
                                className={textFieldCss}
                                type="number"
                                error={errors.frequency_penalty?.message}
                                step="0.01"
                                label={t("frequency-penalty")}
                                disabled={selectedModelThinking}
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
                                disabled={selectedModelThinking}
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
                                disabled={selectedModelThinking}
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
                                disabled={selectedModelThinking}
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

              <div
                className={css`
                  display: flex;
                  justify-content: space-between;
                  flex-wrap: wrap;
                `}
              >
                <div
                  className={css`
                    flex: 1;
                  `}
                >
                  <Button
                    type="submit"
                    size="medium"
                    variant="primary"
                    disabled={configureChatbotMutation.isPending}
                  >
                    {t("save")}
                  </Button>
                  <Button
                    disabled={oldChatbotConf.prompt === ""}
                    type="button"
                    size="medium"
                    variant="blue"
                    onClick={() => setChatbotPreview(true)}
                  >
                    {t("save-and-preview-chatbot")}
                  </Button>
                </div>
                <div>
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
                        deleteChatbotMutation.mutate({
                          path: {
                            chatbot_configuration_id: oldChatbotConf.id,
                          },
                        })
                      }
                    }}
                  >
                    {t("delete")}
                  </Button>
                </div>
                <ChatbotPreviewModal
                  open={showChatbotPreview}
                  onClose={() => setChatbotPreview(false)}
                  chatbotConfigurationId={oldChatbotConf.id}
                />
              </div>
            </form>
          </div>
        )
      }}
    </QueryResult>
  )
}

export default ChatbotConfigurationForm
