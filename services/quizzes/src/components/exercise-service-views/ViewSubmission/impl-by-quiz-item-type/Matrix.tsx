import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { faCheckCircle, faTimesCircle } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import React from "react"

import { UserItemAnswerMatrix } from "../../../../../types/quizTypes/answer"
import { PublicSpecQuizItemMatrix } from "../../../../../types/quizTypes/publicSpec"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

import { QuizItemSubmissionComponentProps } from "."

const MatrixTableContainer = styled.table`
  margin: auto;
  margin-top: 1rem;
  border-collapse: collapse;

  td {
    border-top: none;
  }

  tr:last-child td {
    border-bottom: none;
  }

  tr td:last-child {
    border-right: none;
  }

  tr td:first-child {
    border-left: none;
  }

  tbody {
    border-left: 2px solid #718dbf;
    border-right: 2px solid #718dbf;
    position: relative;
  }

  .top-left:before {
    position: absolute;
    content: "";
    width: 15px;
    border-top: 2px solid #718dbf;
    top: 0%;
    left: -0.8%;
  }

  .top-right:before {
    position: absolute;
    content: "";
    width: 15px;
    border-top: 2px solid #718dbf;
    top: 0%;
    right: -0.6%;
  }

  .bottom-left:before {
    position: absolute;
    content: "";
    width: 15px;
    border-bottom: 2px solid #718dbf;
    bottom: 0%;
    left: -0.8%;
  }

  .bottom-right {
    position: absolute;
    content: "";
    width: 15px;
    border-bottom: 2px solid #718dbf;
    bottom: 0%;
    right: -0.6%;
  }
`

interface isCellCorrectObject {
  text: string
  correct: boolean | null
}

const MatrixSubmission: React.FC<
  QuizItemSubmissionComponentProps<PublicSpecQuizItemMatrix, UserItemAnswerMatrix>
> = ({ quiz_item_model_solution, user_quiz_item_answer, quiz_item_answer_feedback }) => {
  const modelSolution = quiz_item_model_solution as UserItemAnswerMatrix | null
  const correctAnswers = modelSolution?.matrix
  const studentAnswers = user_quiz_item_answer.matrix

  if (!studentAnswers) {
    // eslint-disable-next-line i18next/no-literal-string
    throw new Error("No student answers")
  }

  const isIncorrect = quiz_item_answer_feedback?.correctnessCoefficient != 1

  const findOptionText = (
    column: number,
    row: number,
    isStudentsAnswer: boolean,
  ): isCellCorrectObject => {
    if (!correctAnswers) {
      if (!isStudentsAnswer && modelSolution) {
        return {
          text: modelSolution.optionCells[row][column],
          correct: null,
        }
      }
      return {
        text: studentAnswers[row][column],
        correct: null,
      }
    }
    let correct = studentAnswers[row][column] === correctAnswers[row][column]
    let text = studentAnswers[row][column]
    if (!isStudentsAnswer) {
      correct = true
      text = correctAnswers[row][column]
    }
    return {
      text: text,
      correct: correct,
    }
  }
  const rowsCountArray: number[] = []
  const columnsCountArray: number[] = []

  const msRowsCountArray: number[] = []
  const msColumnsCountArray: number[] = []

  const containsNonEmptyString = (arr: string[]): boolean =>
    arr.some((item) => typeof item === "string" && item.trim() !== "")

  let countRows = 0
  let countColumns = 0

  let msCountRows = 0
  let msCountColumns = 0

  studentAnswers?.forEach((answer, index) => {
    if (containsNonEmptyString(answer)) {
      rowsCountArray.push(countRows)
      countRows += 1

      index == 0 &&
        answer?.forEach((item) => {
          if (item !== "") {
            columnsCountArray.push(countColumns)
            countColumns += 1
          }
        })
    }
  })

  const modelSolutionMatrix = modelSolution?.optionCells

  modelSolutionMatrix?.forEach((answer, index) => {
    if (containsNonEmptyString(answer)) {
      msRowsCountArray.push(msCountRows)
      msCountRows += 1

      index == 0 &&
        answer?.forEach((item) => {
          if (item !== "") {
            msColumnsCountArray.push(msCountColumns)
            msCountColumns += 1
          }
        })
    }
  })

  if (isIncorrect) {
    return (
      <div
        // eslint-disable-next-line i18next/no-literal-string
        aria-label="double"
        className={css`
          display: flex;
          justify-content: space-evenly;
        `}
      >
        <div>
          <MatrixTable
            isStudentsAnswer={true}
            rowsCountArray={rowsCountArray}
            columnsCountArray={columnsCountArray}
            findOptionText={findOptionText}
          ></MatrixTable>
          {correctAnswers && <FontAwesomeIcon icon={faTimesCircle} color="#D75861" size="lg" />}
        </div>
        {modelSolutionMatrix && (
          <div>
            <MatrixTable
              rowsCountArray={msRowsCountArray}
              columnsCountArray={msColumnsCountArray}
              findOptionText={findOptionText}
            ></MatrixTable>
            <div
              className={css`
                display: flex;
                justify-content: center;

                svg {
                  margin-top: 0.563;
                }
              `}
            >
              <FontAwesomeIcon icon={faCheckCircle} color="#69AF8A" size="lg" />
            </div>
          </div>
        )}
      </div>
    )
  } else {
    return (
      <MatrixTable
        // eslint-disable-next-line i18next/no-literal-string
        aria-label="single"
        rowsCountArray={rowsCountArray}
        columnsCountArray={columnsCountArray}
        findOptionText={findOptionText}
      ></MatrixTable>
    )
  }
}

interface MatrixTableProps {
  rowsCountArray: number[]
  columnsCountArray: number[]
  findOptionText: (column: number, row: number, isStudentsAnswer: boolean) => isCellCorrectObject
  isStudentsAnswer?: boolean
}

const MatrixTable: React.FC<React.PropsWithChildren<MatrixTableProps>> = ({
  rowsCountArray,
  columnsCountArray,
  findOptionText,
  isStudentsAnswer = false,
}) => {
  return (
    <MatrixTableContainer>
      <tbody>
        <div className="top-left"></div>
        <div className="top-right"></div>
        <div className="bottom-left"></div>
        <div className="bottom-right"></div>
        <>
          {rowsCountArray.map((row) => {
            return (
              <tr key={`row${row}`}>
                {columnsCountArray.map((column) => {
                  const cell = findOptionText(column, row, isStudentsAnswer)
                  if (cell !== null) {
                    console.log("cell", cell, "row", row, "column", column)
                    return (
                      <td
                        key={`cell ${row} ${column}`}
                        className={css`
                          padding: 0;
                          font-size: 2.8vw;
                          font-size: 22px;
                          font-family:
                            Josefin Sans,
                            sans-serif;
                        `}
                      >
                        <div
                          className={css`
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            width: 50px;
                            height: 50px;
                            border: 0;
                            outline: none;
                            text-align: center;
                            resize: none;
                            ${cell.text.length === 0 &&
                            `
                              background-color: #f5f6f7;
                            `}
                            ${cell.text !== "" &&
                            `
                                background-color: #f9f9f9;
                                color: #4C5868;
                                `}
                                ${cell.correct === false &&
                            `background-color: #bfbec6;
                                `}
                          `}
                        >
                          <p
                            className={css`
                              position: relative;
                              bottom: -3px;
                            `}
                          >
                            {cell.text}
                          </p>
                        </div>
                      </td>
                    )
                  }
                })}
              </tr>
            )
          })}
        </>
      </tbody>
    </MatrixTableContainer>
  )
}

export default withErrorBoundary(MatrixSubmission)
