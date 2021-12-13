import { css } from "@emotion/css"
import React, { useState } from "react"

import { QuizItemComponentProps } from ".."
import { MatrixItemAnswer, QuizItemAnswer } from "../../../../types/types"

import MatrixCell from "./MatrixCell"

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
  const [matrixVariable, setMatrixVariable] = useState<MatrixItemAnswer[][]>(() => {
    const quizAnswers: MatrixItemAnswer[][] = []
    for (let i = 0; i < 6; i++) {
      const rowArray: MatrixItemAnswer[] = []
      for (let j = 0; j < 6; j++) {
        const correctColumnOption = quizItem.options.find(
          (option) => option.row === i && option.column === j,
        )

        if (correctColumnOption) {
          rowArray.push({
            optionId: correctColumnOption.id,
            textData: "",
          })
        } else {
          // eslint-disable-next-line i18next/no-literal-string
          rowArray.push({ optionId: "error", textData: "error" })
        }
      }
      quizAnswers.push(rowArray)
    }
    return quizAnswers
  })

  if (!quizItemAnswerState) {
    return <div></div>
  }
  const handleOptionSelect = (
    text: string,
    option: MatrixItemAnswer,
    column: number,
    row: number,
  ) => {
    const selectedOptionId = option.optionId
    const newMatrixItemAnswer = {
      optionId: selectedOptionId,
      textData: text,
    }

    matrixVariable[column][row] = newMatrixItemAnswer
    setMatrixVariable(matrixVariable)

    let newOptionCells: MatrixItemAnswer[][] = [[]]
    if (quizItemAnswerState?.optionCells) {
      newOptionCells = quizItemAnswerState?.optionCells
    } else {
      newOptionCells = matrixVariable
    }

    const newItemAnswer: QuizItemAnswer = {
      ...quizItemAnswerState,
      optionCells: newOptionCells,
      valid: true,
    }
    setQuizItemAnswerState(newItemAnswer)
  }

  const findOptionText = (column: number, row: number): string => {
    return matrixVariable[column][row].textData
  }

  const findOption = (column: number, row: number) => {
    return matrixVariable[column][row]
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
                  {tempArray.map((columnIndex) => {
                    const cellOption = findOption(columnIndex, rowIndex)
                    if (cellOption !== null) {
                      return (
                        <MatrixCell
                          key={`${columnIndex} ${rowIndex}`}
                          column={columnIndex}
                          row={rowIndex}
                          option={cellOption}
                          findOptionText={findOptionText}
                          handleOptionSelect={handleOptionSelect}
                        >
                          {" "}
                        </MatrixCell>
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
