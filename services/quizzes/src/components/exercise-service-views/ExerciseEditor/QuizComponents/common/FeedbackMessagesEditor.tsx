import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { Trash } from "@vectopus/atlas-icons-react"
import React from "react"
import { useTranslation } from "react-i18next"

import Button from "@/shared-module/common/components/Button"
import SelectField from "@/shared-module/common/components/InputFields/SelectField"
import { primaryFont } from "@/shared-module/exercise-react/styles"

import type {
  QuizFeedbackVisibility,
  QuizOptionFeedbackVisibility,
} from "../../../../../../types/quizTypes/privateSpec"
import ParsedTextField from "./ParsedTextField"

export interface FeedbackVisibilityOption<V extends string> {
  value: V
  label: string
}

interface FeedbackMessage<V extends string> {
  visibility: V
  message: string
}

interface FeedbackMessagesEditorProps<V extends string> {
  value: FeedbackMessage<V>[]
  visibilityOptions: FeedbackVisibilityOption<V>[]
  onChange: (value: FeedbackMessage<V>[]) => void
}

const Title = styled.div`
  font-size: 20px;
  font-family: ${primaryFont};
  font-weight: bold;
  margin-top: 12px;
`

const FeedbackRow = styled.div`
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  gap: 8px;
  margin-bottom: 8px;
`

const VisibilityContainer = styled.div`
  width: 260px;
  flex-shrink: 0;
`

const MessageContainer = styled.div`
  flex-grow: 1;
  min-width: 0;
`

// Five-level item/quiz visibility list, translated. The tag decides which channel the message
// flows through at grading time.
export const useItemFeedbackVisibilityOptions =
  (): FeedbackVisibilityOption<QuizFeedbackVisibility>[] => {
    const { t } = useTranslation()
    const OPTIONS: FeedbackVisibilityOption<QuizFeedbackVisibility>[] = [
      { value: "after-any-answer", label: t("feedback-visibility-after-any-answer") },
      { value: "after-correct-answer", label: t("feedback-visibility-after-correct-answer") },
      {
        value: "after-partially-correct-answer",
        label: t("feedback-visibility-after-partially-correct-answer"),
      },
      { value: "after-incorrect-answer", label: t("feedback-visibility-after-incorrect-answer") },
      { value: "on-model-solution", label: t("feedback-visibility-on-model-solution") },
    ]
    return OPTIONS
  }

// Two-level option visibility list (today's semantics), translated.
export const useOptionFeedbackVisibilityOptions =
  (): FeedbackVisibilityOption<QuizOptionFeedbackVisibility>[] => {
    const { t } = useTranslation()
    const OPTIONS: FeedbackVisibilityOption<QuizOptionFeedbackVisibility>[] = [
      {
        value: "when-selected-after-answer",
        label: t("feedback-visibility-when-selected-after-answer"),
      },
      { value: "on-model-solution", label: t("feedback-visibility-on-model-solution") },
    ]
    return OPTIONS
  }

// Controlled editor: an array of { visibility, message } rows plus an add button. Generic over the
// visibility union so item/quiz (5 levels) and option (2 levels) scopes share one implementation.
const FeedbackMessagesEditor = <V extends string>({
  value,
  visibilityOptions,
  onChange,
}: FeedbackMessagesEditorProps<V>): React.ReactElement => {
  const { t } = useTranslation()

  return (
    <div>
      <Title> {t("feedback-messages")} </Title>
      {value.map((message, index) => (
        <FeedbackRow key={index}>
          <VisibilityContainer>
            <SelectField
              id={`feedback-message-visibility-${index}`}
              className={css`
                margin-bottom: 0;
              `}
              value={message.visibility}
              options={visibilityOptions}
              label={t("feedback-message-visibility")}
              onChangeByValue={(newVisibility) => {
                onChange(
                  value.map((m, i) => (i === index ? { ...m, visibility: newVisibility as V } : m)),
                )
              }}
            />
          </VisibilityContainer>
          <MessageContainer>
            <ParsedTextField
              label={t("feedback-message-text")}
              value={message.message}
              onChange={(newMessage) => {
                onChange(value.map((m, i) => (i === index ? { ...m, message: newMessage } : m)))
              }}
            />
          </MessageContainer>
          <Button
            aria-label={t("remove")}
            variant="icon"
            size="small"
            onClick={() => {
              onChange(value.filter((_, i) => i !== index))
            }}
          >
            <Trash size={16} />
          </Button>
        </FeedbackRow>
      ))}
      <Button
        variant="tertiary"
        size="medium"
        onClick={() => {
          const firstVisibility = visibilityOptions[0]
          if (!firstVisibility) {
            return
          }
          onChange([...value, { visibility: firstVisibility.value, message: "" }])
        }}
      >
        {t("add-feedback-message")}
      </Button>
    </div>
  )
}

export default FeedbackMessagesEditor
