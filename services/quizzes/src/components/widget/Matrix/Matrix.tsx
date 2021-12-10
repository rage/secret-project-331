import { css } from "@emotion/css"
import React from "react"

import { QuizItemComponentProps } from ".."
import { MatrixItemAnswer, PublicQuizItemOption, QuizItemAnswer } from "../../../../types/types"

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
    }
    const newOptionCells: MatrixItemAnswer[][] = quizItemAnswerState.optionCells

    newOptionCells[column][row] = newMatrixItemAnswer

    const newItemAnswer: QuizItemAnswer = {
      ...quizItemAnswerState,
      optionCells: newOptionCells,
      valid: true,
    }

    setQuizItemAnswerState(newItemAnswer)
  }

  if (quizItemAnswerState?.optionCells === null) {
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
    if (quizAnswers !== undefined && quizAnswers.length !== 0) {
      const newItemAnswer: QuizItemAnswer = {
        ...quizItemAnswerState,
        optionCells: quizAnswers,
      }
      setQuizItemAnswerState(newItemAnswer)
    }
  }

  const findOptionText = (column: number, row: number): string => {
    const optionCells = quizItemAnswerState?.optionCells
    if (optionCells !== null && optionCells !== undefined) {
      return optionCells[column][row].textData
    } else {
      return ""
    }
  }

  const checkNeighbourCells = (column: number, row: number) => {
    const findOption = quizItem.options.find(
      (option) => option.column === column && option.row === row,
    )

    if (findOption !== undefined) {
      return findOption
    } else {
      return null
    }
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
                    const checkNeighbour = checkNeighbourCells(columnIndex, rowIndex)
                    if (checkNeighbour !== null) {
                      return (
                        <MatrixCell
                          key={`${columnIndex} ${rowIndex}`}
                          column={columnIndex}
                          row={rowIndex}
                          option={checkNeighbour}
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
