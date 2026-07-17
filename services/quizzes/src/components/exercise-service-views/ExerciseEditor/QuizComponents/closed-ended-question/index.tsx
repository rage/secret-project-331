import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { PlusCircle, Trash } from "@vectopus/atlas-icons-react"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { checkClosedEndedQuestionCorrectness } from "@/grading/assessment/closed-ended-question"
import Accordion from "@/shared-module/common/components/Accordion"
import Button from "@/shared-module/common/components/Button"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import RadioButton from "@/shared-module/common/components/InputFields/RadioButton"
import SelectField from "@/shared-module/common/components/InputFields/SelectField"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import { primaryFont } from "@/shared-module/exercise-react/styles"

import type {
  ClosedEndedQuestionGradingStrategy,
  PrivateSpecQuizItemClosedEndedQuestion,
} from "../../../../../../types/quizTypes/privateSpec"
import useQuizzesExerciseServiceOutputState from "../../../../../hooks/useQuizzesExerciseServiceOutputState"
import findQuizItem from "../../utils/general"
import EditorCard from "../common/EditorCard"
import ParsedTextField from "../common/ParsedTextField"

interface ClosedEndedQuestionEditorProps {
  quizItemId: string
}

interface TestTableProps {
  testStrings: string[]
  quizItem: PrivateSpecQuizItemClosedEndedQuestion
}

const OptionTitle = styled.div`
  font-size: 20px;
  font-family: ${primaryFont};
  font-weight: bold;
  margin-top: 12px;
`

const RadioButtonContainer = styled.div`
  display: flex;
  flex-direction: row;
  gap: 4px;
`

const StrategyFields = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`

const AcceptedAnswerRow = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
`

const convertToString = (regexInput: string | null) => {
  return regexInput ? regexInput : ""
}

// Presets for the optional input-format regex. This is UX validation only (public-safe) and is
// intentionally separate from the grading strategy, which decides correctness.
const FORMAT_PRESETS = [
  { label: "String", value: "\\S+" },
  { label: "Date (mm/dd/YYYY)", value: "\\d{2}\\/\\d{2}\\/\\d{4}" },
  { label: "Date (YYYY-mm-dd)", value: "\\d{2}\\-\\d{2}\\-\\d{4}" },
  { label: "Date (dd.mm.YYYY)", value: "\\d{2}\\.\\d{2}\\.\\d{4}" },
  { label: "Whole number", value: "\\d+" },
  { label: "Decimal", value: "\\d+\\,\\d+" },
]
const FORMAT_NONE = ""
const FORMAT_CUSTOM = "__custom__"

const defaultStrategyFor = (
  strategy: ClosedEndedQuestionGradingStrategy["strategy"],
): ClosedEndedQuestionGradingStrategy => {
  switch (strategy) {
    case "exact-match":
      return { strategy, acceptedAnswers: [""], caseSensitive: false, trimWhitespace: true }
    case "regex":
      return {
        strategy,
        pattern: "",
        caseSensitive: true,
        matchWholeAnswer: true,
        exampleCorrectAnswer: null,
      }
    case "numeric":
      return { strategy, correctValue: 0, tolerance: 0, acceptCommaAsDecimalSeparator: true }
  }
}

const TestButtonContainer = styled.div`
  * {
    margin: 0px;
    margin-bottom: 8px;
  }
`

const RegexTestTableContainer = styled.div`
  display: flex;
`

const TestTable = styled.table`
  margin-left: auto;
  margin-right: auto;
`

const RegexTableHeaderCell = styled.th`
  background-color: #f9f9f9;
  padding: 8px;
`

const RegexTableStringCell = styled.td`
  background-color: #f9f9f9;
  padding: 6px;
  min-width: 150px;
`

const RegexTableCorrectCell = styled.td`
  background-color: #dae6e5;
  color: #065853;
  padding: 4px;
  text-align: center;
  text-transform: uppercase;
`

const RegexTableFailedCell = styled.td`
  background-color: #f0e1dd;
  color: #a84835;
  padding: 4px;
  text-align: center;
  text-transform: uppercase;
`

const AddNewRowContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
`

const formatMatches = (formatRegex: string | null, value: string): boolean => {
  if (!formatRegex) {
    return true
  }
  try {
    return new RegExp(formatRegex).test(value)
  } catch (_e) {
    return false
  }
}

// Shows, per test string, whether it passes the input-format check and whether the grading strategy
// would mark it correct. Correctness reuses the exact function students are graded by.
const RegexTestTable: React.FC<TestTableProps> = ({ quizItem, testStrings }) => {
  const { t } = useTranslation()

  const result = testStrings.map((string) => ({
    string,
    format: formatMatches(quizItem.formatRegex, string),
    validation: checkClosedEndedQuestionCorrectness(quizItem.gradingStrategy, string),
  }))

  return (
    <TestTable>
      <tr key={`test-table-headers`}>
        <RegexTableHeaderCell> {t("string")} </RegexTableHeaderCell>
        <RegexTableHeaderCell> {t("format")} </RegexTableHeaderCell>
        <RegexTableHeaderCell> {t("validation")} </RegexTableHeaderCell>
      </tr>
      {result.map((row, idx) => (
        <tr key={`test-table-row-${idx}`}>
          <RegexTableStringCell> {row.string} </RegexTableStringCell>
          {row.format ? (
            <RegexTableCorrectCell> {t("passed")} </RegexTableCorrectCell>
          ) : (
            <RegexTableFailedCell> {t("failed")} </RegexTableFailedCell>
          )}
          {row.validation ? (
            <RegexTableCorrectCell> {t("passed")} </RegexTableCorrectCell>
          ) : (
            <RegexTableFailedCell> {t("failed")} </RegexTableFailedCell>
          )}
        </tr>
      ))}
    </TestTable>
  )
}

const ClosedEndedQuestionEditor: React.FC<ClosedEndedQuestionEditorProps> = ({ quizItemId }) => {
  const { t } = useTranslation()
  const [testStrings, setTestStrings] = useState([""])

  const { selected, updateState } =
    useQuizzesExerciseServiceOutputState<PrivateSpecQuizItemClosedEndedQuestion>((quiz) => {
      return findQuizItem<PrivateSpecQuizItemClosedEndedQuestion>(
        quiz,
        quizItemId,
        // oxlint-disable-next-line i18next/no-literal-string
        "closed-ended-question",
      )
    })

  const { selected: totalNumberOfQuizItems } = useQuizzesExerciseServiceOutputState<number>(
    (quiz) => {
      return quiz?.items.length ?? 0
    },
  )

  if (!selected) {
    return null
  }

  const showTitleEditor =
    (totalNumberOfQuizItems && totalNumberOfQuizItems > 1) || !!selected?.title

  const strategy = selected.gradingStrategy

  const selectStrategy = (nextStrategy: ClosedEndedQuestionGradingStrategy["strategy"]) => {
    updateState((draft) => {
      if (!draft) {
        return
      }
      // Persist the chosen strategy in the spec. This is the whole point of the redesign: the choice
      // used to live in component-local React state and was silently lost on reopen.
      draft.gradingStrategy = defaultStrategyFor(nextStrategy)
    })
  }

  const handleTestStringChange = (updatedIdx: number) => (value: string) => {
    setTestStrings(testStrings.map((content, idx) => (idx === updatedIdx ? value : content)))
  }

  const addNewString = () => {
    setTestStrings([...testStrings, ""])
  }

  const currentFormatPreset =
    selected.formatRegex === null || selected.formatRegex === ""
      ? FORMAT_NONE
      : (FORMAT_PRESETS.find((preset) => preset.value === selected.formatRegex)?.value ??
        FORMAT_CUSTOM)

  return (
    <EditorCard quizItemId={quizItemId} title={t("quiz-open-name")}>
      {showTitleEditor && (
        <ParsedTextField
          value={selected.title ?? null}
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
      )}

      <OptionTitle> {t("grading-strategy")} </OptionTitle>
      <RadioButtonContainer>
        <RadioButton
          checked={strategy?.strategy === "exact-match"}
          // oxlint-disable-next-line i18next/no-literal-string -- internal strategy identifier
          onClick={() => selectStrategy("exact-match")}
          label={t("exact-string")}
        />
        <RadioButton
          checked={strategy?.strategy === "regex"}
          // oxlint-disable-next-line i18next/no-literal-string -- internal strategy identifier
          onClick={() => selectStrategy("regex")}
          label={t("regex")}
        />
        <RadioButton
          checked={strategy?.strategy === "numeric"}
          // oxlint-disable-next-line i18next/no-literal-string -- internal strategy identifier
          onClick={() => selectStrategy("numeric")}
          label={t("numeric")}
        />
      </RadioButtonContainer>

      {strategy?.strategy === "exact-match" && (
        <StrategyFields>
          <OptionTitle> {t("accepted-answers")} </OptionTitle>
          {strategy.acceptedAnswers.map((answer, idx) => (
            <AcceptedAnswerRow key={`accepted-answer-${idx}`}>
              <TextField
                value={answer}
                label={t("correct-answer")}
                name={t("correct-answer")}
                onChangeByValue={(value) => {
                  updateState((draft) => {
                    if (draft?.gradingStrategy?.strategy !== "exact-match") {
                      return
                    }
                    draft.gradingStrategy.acceptedAnswers[idx] = value
                  })
                }}
              />
              <Button
                aria-label={t("remove")}
                size="small"
                variant="icon"
                onClick={() => {
                  updateState((draft) => {
                    if (draft?.gradingStrategy?.strategy !== "exact-match") {
                      return
                    }
                    draft.gradingStrategy.acceptedAnswers.splice(idx, 1)
                  })
                }}
              >
                <Trash size={16} />
              </Button>
            </AcceptedAnswerRow>
          ))}
          <AddNewRowContainer>
            <Button
              aria-label={t("add-accepted-answer")}
              size="small"
              variant="icon"
              onClick={() => {
                updateState((draft) => {
                  if (draft?.gradingStrategy?.strategy !== "exact-match") {
                    return
                  }
                  draft.gradingStrategy.acceptedAnswers.push("")
                })
              }}
            >
              <PlusCircle size={18} />
            </Button>
            <p> {t("add-accepted-answer")}</p>
          </AddNewRowContainer>
          <CheckBox
            label={t("case-sensitive")}
            checked={strategy.caseSensitive}
            onChangeByValue={(checked) => {
              updateState((draft) => {
                if (draft?.gradingStrategy?.strategy !== "exact-match") {
                  return
                }
                draft.gradingStrategy.caseSensitive = checked
              })
            }}
          />
          <CheckBox
            label={t("ignore-extra-whitespace")}
            checked={strategy.trimWhitespace}
            onChangeByValue={(checked) => {
              updateState((draft) => {
                if (draft?.gradingStrategy?.strategy !== "exact-match") {
                  return
                }
                draft.gradingStrategy.trimWhitespace = checked
              })
            }}
          />
        </StrategyFields>
      )}

      {strategy?.strategy === "regex" && (
        <StrategyFields>
          <TextField
            value={strategy.pattern}
            label={t("regex-pattern")}
            name={t("regex-pattern")}
            onChangeByValue={(value) => {
              updateState((draft) => {
                if (draft?.gradingStrategy?.strategy !== "regex") {
                  return
                }
                draft.gradingStrategy.pattern = value
              })
            }}
          />
          <CheckBox
            label={t("case-sensitive")}
            checked={strategy.caseSensitive}
            onChangeByValue={(checked) => {
              updateState((draft) => {
                if (draft?.gradingStrategy?.strategy !== "regex") {
                  return
                }
                draft.gradingStrategy.caseSensitive = checked
              })
            }}
          />
          <CheckBox
            label={t("match-whole-answer")}
            checked={strategy.matchWholeAnswer}
            onChangeByValue={(checked) => {
              updateState((draft) => {
                if (draft?.gradingStrategy?.strategy !== "regex") {
                  return
                }
                draft.gradingStrategy.matchWholeAnswer = checked
              })
            }}
          />
          <TextField
            value={convertToString(strategy.exampleCorrectAnswer)}
            label={t("example-correct-answer")}
            name={t("example-correct-answer")}
            onChangeByValue={(value) => {
              updateState((draft) => {
                if (draft?.gradingStrategy?.strategy !== "regex") {
                  return
                }
                draft.gradingStrategy.exampleCorrectAnswer = value === "" ? null : value
              })
            }}
          />
        </StrategyFields>
      )}

      {strategy?.strategy === "numeric" && (
        <StrategyFields>
          <TextField
            type="number"
            value={String(strategy.correctValue)}
            label={t("numeric-correct-value")}
            name={t("numeric-correct-value")}
            onChangeByValue={(value) => {
              updateState((draft) => {
                if (draft?.gradingStrategy?.strategy !== "numeric") {
                  return
                }
                draft.gradingStrategy.correctValue = Number(value)
              })
            }}
          />
          <TextField
            type="number"
            value={String(strategy.tolerance)}
            label={t("numeric-tolerance")}
            name={t("numeric-tolerance")}
            onChangeByValue={(value) => {
              updateState((draft) => {
                if (draft?.gradingStrategy?.strategy !== "numeric") {
                  return
                }
                draft.gradingStrategy.tolerance = Number(value)
              })
            }}
          />
          <CheckBox
            label={t("accept-comma-as-decimal-separator")}
            checked={strategy.acceptCommaAsDecimalSeparator}
            onChangeByValue={(checked) => {
              updateState((draft) => {
                if (draft?.gradingStrategy?.strategy !== "numeric") {
                  return
                }
                draft.gradingStrategy.acceptCommaAsDecimalSeparator = checked
              })
            }}
          />
        </StrategyFields>
      )}

      <OptionTitle> {t("answer-format-optional")} </OptionTitle>
      <SelectField
        id="format-preset-select"
        label={t("format-regular-expression")}
        defaultValue={currentFormatPreset}
        options={[
          { label: t("label-null"), value: FORMAT_NONE },
          ...FORMAT_PRESETS,
          ...(currentFormatPreset === FORMAT_CUSTOM
            ? [{ label: t("answer-format-custom"), value: FORMAT_CUSTOM, disabled: true }]
            : []),
        ]}
        onChangeByValue={(value) => {
          updateState((draft) => {
            if (!draft) {
              return
            }
            draft.formatRegex = value === FORMAT_NONE ? null : value
          })
        }}
      />
      <TextField
        value={convertToString(selected.formatRegex)}
        label={t("format-regular-expression")}
        name={t("format-regular-expression")}
        onChangeByValue={(value) => {
          updateState((draft) => {
            if (!draft) {
              return
            }
            draft.formatRegex = value === "" ? null : value
          })
        }}
      />

      <Accordion title={t("advanced-options")}>
        <details>
          <summary> {t("advanced-options")} </summary>
          <TestButtonContainer>
            {testStrings.map((string, idx) => (
              <TextField
                key={`test-string-field-${idx}`}
                value={string}
                onChangeByValue={handleTestStringChange(idx)}
                label={t("test-string")}
                name={t("test-string")}
              />
            ))}
            <AddNewRowContainer>
              <Button
                aria-label={t("button-add-example")}
                className={css`
                  cursor: pointer;
                  padding-right: 2px !important;
                  padding-left: 2px !important;
                  margin-left: 2px !important;
                  margin-top: 8px !important;
                `}
                size="small"
                variant="icon"
                onClick={() => addNewString()}
              >
                <PlusCircle
                  className={css`
                    background-color: #dae6e5;
                    display: inline;
                    border-radius: 50%;
                    :hover {
                      background-color: #bcd1d0;
                    }
                  `}
                  size={18}
                />
              </Button>
              <p> {t("add-example-string")}</p>
            </AddNewRowContainer>
          </TestButtonContainer>
          <RegexTestTableContainer>
            <RegexTestTable quizItem={selected} testStrings={testStrings} />
          </RegexTestTableContainer>
          <ParsedTextField
            value={selected.messageOnModelSolution ?? ""}
            onChange={(newValue) => {
              updateState((draft) => {
                if (!draft) {
                  return
                }
                draft.messageOnModelSolution = newValue
              })
            }}
            label={t("label-message-on-model-solution")}
          />
        </details>
      </Accordion>
    </EditorCard>
  )
}

export default ClosedEndedQuestionEditor
