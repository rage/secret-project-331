import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { PlusCircle } from "@vectopus/atlas-icons-react"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { PrivateSpecQuizItemClosedEndedQuestion } from "../../../../../../types/quizTypes/privateSpec"
import useQuizzesExerciseServiceOutputState from "../../../../../hooks/useQuizzesExerciseServiceOutputState"
import Accordion from "../../../../../shared-module/common/components/Accordion"
import Button from "../../../../../shared-module/common/components/Button"
import RadioButton from "../../../../../shared-module/common/components/InputFields/RadioButton"
import SelectField from "../../../../../shared-module/common/components/InputFields/SelectField"
import TextField from "../../../../../shared-module/common/components/InputFields/TextField"
import { primaryFont } from "../../../../../shared-module/common/styles"
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
`

const RadioButtonContainer = styled.div`
  display: flex;
  flex-direction: row;
  gap: 4px;
`

const convertToString = (regexInput: string | null) => {
  return regexInput ? regexInput : ""
}

const REGEX_PATTERNS = [
  {
    label: "String",
    value: "\\S+",
  },
  {
    label: "Date (mm/dd/YYYY)",
    value: "\\d{2}\\/\\d{2}\\/\\d{4}",
  },
  {
    label: "Date (YYYY-mm-dd)",
    value: "\\d{2}\\-\\d{2}\\-\\d{4}",
  },
  {
    label: "Date (dd.mm.YYYY)",
    value: "\\d{2}\\.\\d{2}\\.\\d{4}",
  },
  {
    label: "Whole number",
    value: "\\d+",
  },
  {
    label: "Decimal",
    value: "\\d+\\,\\d+",
  },
]

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

const RegexTestTable: React.FC<TestTableProps> = ({ quizItem, testStrings }) => {
  const { t } = useTranslation()

  const validateStrings = () => {
    try {
      const validationRegExp = new RegExp(convertToString(quizItem.validityRegex))
      const formatRegExp = new RegExp(convertToString(quizItem.formatRegex))

      return testStrings.map((string) => {
        return {
          string,
          validation: validationRegExp.test(string),
          format: formatRegExp.test(string),
        }
      })
    } catch (e) {
      /* NOP */
      /* This occurs when there's incomplete regex */
    }
    return testStrings.map((string) => {
      return {
        string,
        validation: false,
        format: false,
      }
    })
  }

  const result = validateStrings()

  return (
    <TestTable>
      <tr key={`test-table-headers`}>
        <RegexTableHeaderCell> {t("string")} </RegexTableHeaderCell>
        <RegexTableHeaderCell> {t("format")} </RegexTableHeaderCell>
        <RegexTableHeaderCell> {t("validation")} </RegexTableHeaderCell>
      </tr>
      {result.map((result, idx) => (
        <tr key={`test-table-row-${idx}`}>
          <RegexTableStringCell> {result.string} </RegexTableStringCell>
          {result.format ? (
            <RegexTableCorrectCell> {t("passed")} </RegexTableCorrectCell>
          ) : (
            <RegexTableFailedCell> {t("failed")} </RegexTableFailedCell>
          )}
          {result.validation ? (
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
  const [method, setMethod] = useState(0)
  const [testStrings, setTestStrings] = useState([""])

  const { selected, updateState } =
    useQuizzesExerciseServiceOutputState<PrivateSpecQuizItemClosedEndedQuestion>((quiz) => {
      // eslint-disable-next-line i18next/no-literal-string
      return findQuizItem<PrivateSpecQuizItemClosedEndedQuestion>(
        quiz,
        quizItemId,
        // eslint-disable-next-line i18next/no-literal-string
        "closed-ended-question",
      )
    })

  if (!selected) {
    return <></>
  }
  const handleTestStringChange = (updatedIdx: number) => (value: string) => {
    setTestStrings(
      testStrings.map((content, idx) => {
        if (idx == updatedIdx) {
          return value
        }
        return content
      }),
    )
  }

  const addNewString = () => {
    setTestStrings([...testStrings, ""])
  }

  return (
    <EditorCard quizItemId={quizItemId} title={t("quiz-open-name")}>
      <OptionTitle> {t("grading-strategy")} </OptionTitle>
      <RadioButtonContainer>
        <RadioButton
          checked={method == 0}
          onClick={() => setMethod(0)}
          label={t("exact-string")}
        ></RadioButton>
        <RadioButton
          checked={method == 1}
          onClick={() => setMethod(1)}
          label={t("regex")}
        ></RadioButton>
      </RadioButtonContainer>

      {method == 0 && (
        <>
          <SelectField
            id="regex-pattern-select"
            label={t("format-regular-expression")}
            options={REGEX_PATTERNS}
            onChangeByValue={(value) => {
              updateState((draft) => {
                if (!draft) {
                  return
                }
                draft.formatRegex = value
              })
            }}
          />
          <TextField
            value={convertToString(selected.validityRegex)}
            onChangeByValue={(value) => {
              updateState((draft) => {
                if (!draft) {
                  return
                }
                draft.validityRegex = value
              })
            }}
            label={t("correct-answer")}
            name={t("correct-answer")}
          />
        </>
      )}
      {method == 1 && (
        <>
          <TextField
            value={convertToString(selected.validityRegex)}
            onChangeByValue={(value) => {
              updateState((draft) => {
                if (!draft) {
                  return
                }
                draft.validityRegex = value
              })
            }}
            label={t("validity-regular-expression")}
            name={t("validity-regular-expression")}
          />
          <TextField
            value={convertToString(selected.formatRegex)}
            onChangeByValue={(value) => {
              updateState((draft) => {
                if (!draft) {
                  return
                }
                draft.formatRegex = value
              })
            }}
            label={t("format-regular-expression")}
            name={t("format-regular-expression")}
          />
        </>
      )}

      <Accordion variant="detail" title={t("advanced-options")}>
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
                area-aria-label="add example button"
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
