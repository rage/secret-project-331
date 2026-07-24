"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import React, { useState } from "react"
import { useFieldArray, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  configureChatbotMutation as configureChatbotMutationOptions,
  deleteChatbotConfigurationMutation as deleteChatbotMutationOptions,
  getChatbotModelsOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import type { ChatbotConfiguration, NewChatbotConf } from "@/generated/api/types.generated"
import Accordion from "@/shared-module/common/components/Accordion"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import GenericInfobox from "@/shared-module/common/components/GenericInfobox"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { isHtmlButtonElement } from "@/shared-module/common/utils/dom"
import { isReactOnSubmitEvent } from "@/shared-module/common/utils/events"
import {
  assertNotNullOrUndefined,
  includeIf,
  omitUndefined,
} from "@/shared-module/common/utils/nullability"
import { courseChatbotSettingsRoute } from "@/shared-module/common/utils/routes"
import {
  Button,
  Checkbox,
  QueryResult,
  Select,
  TextArea,
  TextField,
} from "@/shared-module/components"

import ChatbotPreviewModal from "./ChatbotPreviewModal"

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

const itemsContainerCss = css`
  flex: 1;
  ${respondToOrLarger.sm} {
    flex: 0 45%;
  }
  display: flex;
  flex-direction: column;
  gap: 1rem;
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
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
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
      ...omitUndefined({ initial_suggested_messages: oldChatbotConf.initial_suggested_messages }),
      ...includeIf(
        oldChatbotConf.initial_suggested_messages !== null &&
          oldChatbotConf.initial_suggested_messages !== undefined,
        {
          suggested_messages: oldChatbotConf.initial_suggested_messages?.map((v) => ({
            message: v,
          })),
        },
      ),
    },
  })

  const [showChatbotPreview, setChatbotPreview] = useState(false)

  // oxlint-disable-next-line i18next/no-literal-string
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

  const onConfigureChatbotWrapper = handleSubmit(async (data, event) => {
    if (!event) {
      throw new Error("handleSubmit triggered without an event")
    }
    if (!isReactOnSubmitEvent(event)) {
      throw new Error("Event does not seem like an react onsbumit event")
    }
    if (!event.submitter || !isHtmlButtonElement(event.submitter)) {
      throw new Error("Event submitter seems wrong")
    }
    await configureChatbotMutation.mutateAsync({
      body: {
        course_id: oldChatbotConf.course_id !== undefined ? oldChatbotConf.course_id : null, // keep the old course id
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

    if (event.submitter.name === "preview") {
      // The preview modal starts a fresh conversation on open so it reflects the just-saved config.
      setChatbotPreview(true)
    }
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
            <form className={itemsContainerCss} onSubmit={onConfigureChatbotWrapper}>
              <TextField
                control={control}
                isRequired
                label={t("label-name")}
                name={"chatbot_name"}
                rules={{ required: t("required-field") }}
              />
              <TextArea
                control={control}
                label={t("prompt")}
                isRequired
                autoResize={true}
                autoResizeMaxHeightPx={900}
                name={"prompt"}
                rules={{ required: t("required-field") }}
              />
              <TextField
                control={control}
                isRequired
                label={t("initial-message")}
                name={"initial_message"}
                rules={{ required: t("required-field") }}
              />
              <div
                className={css`
                  flex-direction: row;
                `}
              >
                <Checkbox
                  control={control}
                  label={t("enabled-to-students")}
                  name={"enabled_to_students"}
                />
              </div>
              <Select
                id="model-select"
                control={control}
                label={t("select-LLM")}
                options={chatbotModels.map((m) => {
                  return {
                    value: m.id,
                    label: `${m.model} (${["GPTThinking", "GPTHardThinking"].includes(m.model_type) ? t("reasoning") : t("non-reasoning")})`,
                  }
                })}
                name={"model_id"}
              />
              <Checkbox control={control} label={t("use-azure-search")} name={"use_azure_search"} />
              <Checkbox control={control} label={t("hide-citations")} name={"hide_citations"} />
              <Checkbox control={control} label={t("enable-tool-use")} name={"use_tools"} />
              <Checkbox
                control={control}
                label={t("suggest-next-messages")}
                name={"suggest_next_messages"}
              />
              <GenericInfobox>{t("recommend-message-suggesting")}</GenericInfobox>
              {suggestMessagesFieldValue && (
                <div className={itemsContainerCss}>
                  <h4>{t("initial-message-suggestions")}</h4>
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
                          control={control}
                          name={`suggested_messages.${idx}.message` as const}
                          key={item.id}
                          errorMessage={errors.suggested_messages?.[idx]?.message?.message}
                          label={t("label-message")}
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
                      <div className={itemsContainerCss}>
                        <h4>{t("configure-tokens")}</h4>
                        <TextField
                          control={control}
                          className={textFieldCss}
                          type="number"
                          label={t("daily-token-user")}
                          name={"daily_tokens_per_user"}
                        />
                        <TextField
                          control={control}
                          className={textFieldCss}
                          type="number"
                          label={t("weekly-token-user")}
                          name={"weekly_tokens_per_user"}
                        />
                        <TextField
                          className={textFieldCss}
                          control={control}
                          type="number"
                          label={
                            selectedModelThinking
                              ? t("max-completion-tokens")
                              : t("max-token-response")
                          }
                          name={"max_output_tokens"}
                          rules={{
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
                          }}
                        />
                      </div>
                      <div className={itemsContainerCss}>
                        <h4>{t("configure-search")}</h4>
                        <div
                          className={css`
                            margin: 20px 20px;
                          `}
                        >
                          <Checkbox
                            control={control}
                            label={t("use-semantic-reranking")}
                            name={"use_semantic_reranking"}
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
                          <div className={itemsContainerCss}>
                            <h4>{t("configure-reasoning")}</h4>
                            <div
                              className={css`
                                margin: 20px 20px;
                              `}
                            >
                              <Select
                                id="verbosity-select"
                                control={control}
                                name={"verbosity"}
                                label={t("select-verbosity")}
                                isDisabled={!selectedModelThinking}
                                options={[
                                  { value: LOW, label: t("reasoning-effort-low") },
                                  { value: MEDIUM, label: t("reasoning-effort-medium") },
                                  { value: HIGH, label: t("reasoning-effort-high") },
                                ]}
                              />
                              <Select
                                id="reasoning-effort-select"
                                label={t("select-reasoning-effort")}
                                name={"reasoning_effort"}
                                control={control}
                                isDisabled={!selectedModelThinking}
                                options={[
                                  { value: NONE, label: t("reasoning-effort-none") },
                                  { value: MINIMAL, label: t("reasoning-effort-minimal") },
                                  { value: LOW, label: t("reasoning-effort-low") },
                                  { value: MEDIUM, label: t("reasoning-effort-medium") },
                                  { value: HIGH, label: t("reasoning-effort-high") },
                                  { value: XHIGH, label: t("reasoning-effort-xhigh") },
                                ]}
                              />
                            </div>
                          </div>
                        ) : (
                          <div>
                            {" "}
                            <div className={itemsContainerCss}>
                              <h3>{t("non-reasoning-model-settings")}</h3>
                              <h4>{t("configure-penalty")}</h4>
                              <TextField
                                className={textFieldCss}
                                control={control}
                                type="number"
                                label={t("frequency-penalty")}
                                step="0.01"
                                isDisabled={selectedModelThinking}
                                name={"frequency_penalty"}
                                rules={{
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
                                }}
                              />
                              <TextField
                                className={textFieldCss}
                                type="number"
                                control={control}
                                label={t("presence-penalty")}
                                step="0.01"
                                isDisabled={selectedModelThinking}
                                name={"presence_penalty"}
                                rules={{
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
                                }}
                              />
                            </div>
                            <div className={itemsContainerCss}>
                              <h4>{t("configure-creativity")}</h4>
                              <TextField
                                control={control}
                                className={textFieldCss}
                                type="number"
                                step="0.01"
                                label={t("temperature")}
                                isDisabled={selectedModelThinking}
                                name={"temperature"}
                                rules={{
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
                                }}
                              />
                              <TextField
                                className={textFieldCss}
                                type="number"
                                control={control}
                                step="0.01"
                                label={t("top-p")}
                                isDisabled={selectedModelThinking}
                                name={"top_p"}
                                rules={{
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
                                }}
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
                    disabled={isSubmitting}
                    type="submit"
                    size="medium"
                    variant="primary"
                    name="save"
                  >
                    {t("save")}
                  </Button>
                  <Button
                    disabled={isSubmitting}
                    type="submit"
                    size="medium"
                    variant="tertiary"
                    className={css`
                      margin-left: 0.5rem;
                    `}
                    name="preview"
                  >
                    {t("save-and-preview-chatbot")}
                  </Button>
                </div>
                <div>
                  <Button
                    type="button"
                    size="medium"
                    variant="secondary"
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
                {showChatbotPreview && (
                  <ChatbotPreviewModal
                    open={showChatbotPreview}
                    onClose={() => setChatbotPreview(false)}
                    chatbotConfigurationId={oldChatbotConf.id}
                  />
                )}
              </div>
            </form>
          </div>
        )
      }}
    </QueryResult>
  )
}

export default ChatbotConfigurationForm
