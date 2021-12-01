import { css } from "@emotion/css"
import React, { useState } from "react"

import { MatrixItemAnswer, PublicQuizItemOption, QuizItemAnswer } from "../../../types/types"

import { QuizItemComponentProps } from "."

export interface LeftBorderedDivProps {
  correct: boolean | undefined
  direction?: string
  message?: string
}

const Matrix: React.FunctionComponent<QuizItemComponentProps> = ({
  quizItemAnswerState,
  quizItem,
  setQuizItemAnswerState,
}) => {
  const [IsActive, setIsActive] = useState(false)
  const handleOptionSelect = (
    text: string,
    option: PublicQuizItemOption,
    column: number,
    row: number,
  ) => {
    if (!quizItemAnswerState?.optionCells) {
      return
    }

    const selectedOptionId = option.id
    const newMatrixItemAnswer = {
      optionId: selectedOptionId,
      textData: text,
      column: column,
      row: row,
    }
    const newOptionCells: MatrixItemAnswer[] = quizItemAnswerState.optionCells?.map((option) => {
      if (option.optionId === selectedOptionId) {
        return newMatrixItemAnswer
      } else {
        return option
      }
    })

    const newItemAnswer: QuizItemAnswer = {
      ...quizItemAnswerState,
      optionCells: newOptionCells,
      valid: true,
    }

    setQuizItemAnswerState(newItemAnswer)
  }

  if (quizItemAnswerState?.optionCells === null) {
    const initializeQuizAnswers: MatrixItemAnswer[] = quizItem.options.map((option) => {
      if (option.column !== null && option.row !== null) {
        return {
          optionId: option.id,
          textData: "",
          column: option.column,
          row: option.row,
        }
      } else {
        return {
          optionId: option.id,
          textData: "",
          column: -1,
          row: -1,
        }
      }
    })
    if (initializeQuizAnswers !== null) {
      const newItemAnswer: QuizItemAnswer = {
        ...quizItemAnswerState,
        optionCells: initializeQuizAnswers,
      }
      setQuizItemAnswerState(newItemAnswer)
    }
  }

  const findOptionText = (optionId: string): string => {
    const option = quizItemAnswerState?.optionCells?.find((option) => option.optionId === optionId)
    if (option === undefined) {
      return ""
    }
    return option?.textData
  }

  const tempArray = [0, 1, 2, 3, 4, 5]
  return (
    <>
      <table
        className={css`
          margin: auto;
          background-color: grey;
          border-collapse: collapse;
          td {
            border: 2px solid #e1e1e199;
          }
          &tr:first-child td {
            border-top: 4px;
          }
          &tr td:first-child {
            border-left: 4px;
          }
          &tr:last-child td {
            border-bottom: 4px;
          }
          &tr td:last-child {
            border-right: 4px;
          }
        `}
      >
        <tbody>
          <>
            {tempArray.map((rowIndex) => {
              return (
                <tr key={`row${rowIndex}`}>
                  {quizItem.options.map((option, columnIndex) => {
                    if (option.row === rowIndex) {
                      //         const checkNeighbour = checkNeighbourCells(columnIndex, rowIndex)
                      return (
                        <>
                          <>
                            <td
                              key={`cell ${rowIndex} ${columnIndex}`}
                              className={css`
                                padding: 0;
                                font-size: 30px;
                              `}
                            >
                              {
                                <input
                                  className={css`
                                    display: block;
                                    width: 50px;
                                    height: 50px;
                                    border: 0;
                                    outline: none;
                                    text-align: center;
                                    resize: none;
                                    ${option.body?.length === 0 &&
                                    `
                              background-color: #ECECEC;
                            `}
                                    ${IsActive &&
                                    option.body?.length === 0 &&
                                    `
                                background-color: #DBDBDB;
                                `}
                                  `}
                                  value={findOptionText(option.id) ?? ""}
                                  onSelect={() => setIsActive(true)}
                                  onBlur={() => setIsActive(false)}
                                  onChange={(event) =>
                                    handleOptionSelect(
                                      event.target.value,
                                      option,
                                      columnIndex,
                                      rowIndex,
                                    )
                                  }
                                ></input>
                              }
                            </td>
                          </>
                        </>
                      )
                    }
                  })}
                </tr>
              )
            })}
          </>
        </tbody>
      </table>
    </>
  )
}

export default Matrix
