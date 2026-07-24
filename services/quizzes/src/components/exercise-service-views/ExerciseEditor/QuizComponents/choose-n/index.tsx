import styled from "@emotion/styled"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { v4 } from "uuid"

import Accordion from "@/shared-module/common/components/Accordion"
import Button from "@/shared-module/common/components/Button"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import { primaryFont } from "@/shared-module/exercise-react/styles"

import type { PrivateSpecQuizItemChooseN } from "../../../../../../types/quizTypes/privateSpec"
import useQuizzesExerciseServiceOutputState from "../../../../../hooks/useQuizzesExerciseServiceOutputState"
import findQuizItem from "../../utils/general"
import EditorCard from "../common/EditorCard"
import FeedbackMessagesEditor, {
  useItemFeedbackVisibilityOptions,
} from "../common/FeedbackMessagesEditor"
import MultipleChoiceOption from "../common/MultipleChoiceOption"
import ParsedTextField from "../common/ParsedTextField"

interface MultipleChoiceEditorProps {
  quizItemId: string
}

const OptionTitle = styled.div`
  font-size: 20px;
  font-family: ${primaryFont};
  font-weight: bold;
`

const OptionDescription = styled.div`
  font-size: 17px;
  color: #b3b3b3;
  margin-bottom: 12px;
`

const OptionCardContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`

const OptionNameContainer = styled.div`
  width: 80vh;
  display: inline;
  position: relative;
  top: -10px;
`
const OptionCheckBoxContainer = styled.div`
  width: 15vh;
  display: inline;
  margin-left: 20px;
  padding: 0px 8px;
`

const OptionCreationWrapper = styled.div`
  /* Remove margin from input */
  * {
    margin: 0px;
  }
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-bottom: 8px;
  height: 45px;
  margin-top: 16px;
`

const OptionCreationContainer = styled.div`
  background-color: #fbfbfb;
  border: 1px solid #e2e4e6;
  width: 100%;
  margin-top: 28px;
  padding: 20px;
`

const AdvancedOptionsContainer = styled.div`
  padding: 8px;
`

const MultipleChoiceEditor: React.FC<MultipleChoiceEditorProps> = ({ quizItemId }) => {
  const { t } = useTranslation()

  const [optionTitle, setOptionTitle] = useState("")
  const [correct, setCorrect] = useState(false)
  const itemFeedbackVisibilityOptions = useItemFeedbackVisibilityOptions()

  const { selected, updateState } =
    useQuizzesExerciseServiceOutputState<PrivateSpecQuizItemChooseN>((quiz) => {
      // oxlint-disable-next-line i18next/no-literal-string
      return findQuizItem<PrivateSpecQuizItemChooseN>(quiz, quizItemId, "choose-n")
    })

  if (selected === null) {
    return null
  }

  return (
    <EditorCard quizItemId={quizItemId} title={t("quiz-choose-n-name")}>
      <ParsedTextField
        value={selected.title}
        onChange={(title) => {
          updateState((draft) => {
            if (!draft) {
              return
            }
            draft.title = title
          })
        }}
        label={t("title")}
      />
      <TextField
        value={selected.n}
        label={t("quiz-choose-n-description")}
        onChangeByValue={(value) => {
          updateState((draft) => {
            if (!draft) {
              return
            }
            try {
              // oxlint-disable-next-line unicorn/prefer-number-coercion -- parseInt intended; Number() differs
              draft.n = parseInt(value, 10)
            } catch (_e) {
              /* NOP */
            }
          })
        }}
        type={"number"}
      />
      <OptionTitle> {t("title-options")} </OptionTitle>
      <OptionDescription>{t("title-options-description")}</OptionDescription>
      <OptionCardContainer>
        {selected.options.map((option) => (
          <MultipleChoiceOption
            onDelete={() => {
              updateState((draft) => {
                if (!draft) {
                  return
                }
                draft.options = draft.options.filter((opt) => opt.id !== option.id)
              })
            }}
            onUpdateValues={(title, feedbackMessages, correctValue) => {
              updateState((draft) => {
                if (!draft) {
                  return
                }
                draft.options = draft.options.map((opt) => {
                  if (opt.id === option.id) {
                    opt.title = title
                    opt.correct = correctValue
                    opt.feedbackMessages = feedbackMessages
                  }
                  return opt
                })
              })
            }}
            key={option.id}
            option={option}
          />
        ))}
      </OptionCardContainer>

      {/* New multiple choice option input */}
      <OptionCreationContainer>
        <OptionCreationWrapper>
          <OptionNameContainer>
            <ParsedTextField
              value={optionTitle}
              onChange={(title) => {
                setOptionTitle(title)
              }}
              label={t("option-title")}
            />
          </OptionNameContainer>
          <OptionCheckBoxContainer>
            <CheckBox
              checked={correct}
              onChange={() => {
                setCorrect(!correct)
              }}
              label={t("label-correct")}
            />
          </OptionCheckBoxContainer>
        </OptionCreationWrapper>

        <Button
          onClick={() => {
            updateState((draft) => {
              if (!draft) {
                return
              }

              draft.options = [
                ...draft.options,
                {
                  order: draft.options.length + 1,
                  body: null,
                  correct: correct,
                  id: v4(),
                  feedbackMessages: [],
                  title: optionTitle,
                },
              ]
            })
            setCorrect(false)
            setOptionTitle("")
          }}
          variant="primary"
          size={"medium"}
        >
          {t("add-option")}
        </Button>
      </OptionCreationContainer>

      {/* Advanced options */}
      <br />
      <Accordion title={t("advanced-options")}>
        <details>
          <summary> {t("advanced-options")} </summary>
          <AdvancedOptionsContainer>
            <FeedbackMessagesEditor
              value={selected.feedbackMessages}
              visibilityOptions={itemFeedbackVisibilityOptions}
              onChange={(feedbackMessages) => {
                updateState((draft) => {
                  if (!draft) {
                    return
                  }
                  draft.feedbackMessages = feedbackMessages
                })
              }}
            />
          </AdvancedOptionsContainer>
        </details>
      </Accordion>
    </EditorCard>
  )
}

export default MultipleChoiceEditor
