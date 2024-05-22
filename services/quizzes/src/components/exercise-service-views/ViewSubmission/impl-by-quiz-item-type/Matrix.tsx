import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { CheckCircle, XmarkCircle } from "@vectopus/atlas-icons-react"
import React from "react"
import { useTranslation } from "react-i18next"

import { UserItemAnswerMatrix } from "../../../../../types/quizTypes/answer"
import { PublicSpecQuizItemMatrix } from "../../../../../types/quizTypes/publicSpec"

import { QuizItemSubmissionComponentProps } from "."

import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

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
    border-left: 0.125rem solid #718dbf;
    border-right: 0.125rem solid #718dbf;
    position: relative;
  }

  .top-left:before {
    position: absolute;
    content: "";
    width: 0.938rem;
    border-top: 0.125rem solid #718dbf;
    top: 0%;
    left: -0.8%;
  }

  .top-right:before {
    position: absolute;
    content: "";
    width: 0.938rem;
    border-top: 0.125rem solid #718dbf;
    top: 0%;
    right: -0.6%;
  }

  .bottom-left:before {
    position: absolute;
    content: "";
    width: 0.938rem;
    border-bottom: 0.125rem solid #718dbf;
    bottom: 0%;
    left: -0.8%;
  }

  .bottom-right {
    position: absolute;
    content: "";
    width: 0.938rem;
    border-bottom: 0.125rem solid #718dbf;
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
  const { t } = useTranslation()

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
      if (!isStudentsAnswer && modelSolution?.optionCells) {
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

  const modelSolutionRowsCountArray: number[] = []
  const modelSolutionColumnsCountArray: number[] = []

  const containsNonEmptyString = (arr: string[]): boolean =>
    arr.some((item) => typeof item === "string" && item.trim() !== "")

  const modelSolutionMatrix = modelSolution?.optionCells

  const populateRowsAndColumns = (
    matrixArr: string[][] | undefined,
    column: number[],
    row: number[],
  ) => {
    let countRows = 0
    let countColumns = 0
    return matrixArr?.forEach((answer, index) => {
      if (containsNonEmptyString(answer)) {
        column.push(countRows)
        countRows += 1
        index == 0 &&
          answer?.forEach((item) => {
            if (item !== "") {
              row.push(countColumns)
              countColumns += 1
            }
          })
      }
    })
  }

  populateRowsAndColumns(studentAnswers, columnsCountArray, rowsCountArray)
  populateRowsAndColumns(
    modelSolutionMatrix,
    modelSolutionColumnsCountArray,
    modelSolutionRowsCountArray,
  )

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
          {correctAnswers && <XmarkCircle color="#D75861" size={20} />}
        </div>
        {modelSolutionMatrix && (
          <div>
            <MatrixTable
              rowsCountArray={modelSolutionRowsCountArray}
              columnsCountArray={modelSolutionColumnsCountArray}
              findOptionText={findOptionText}
            ></MatrixTable>
            <div
              className={css`
                display: flex;
                justify-content: center;
                align-items: center;
                margin-top: 0.563rem;

                p {
                  font-family: Raleway, sans-serif;
                  color: #4c5868;
                  font-weight: 500;
                  font-size: 1rem;
                  margin-left: 0.3rem;
                }
              `}
            >
              <CheckCircle color="#69AF8A" size={18} />
              <p>{t("correct-option-tag")}</p>
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
                    return (
                      <td
                        key={`cell ${row} ${column}`}
                        className={css`
                          padding: 0;
                          font-size: 2.8vw;
                          font-size: 1.375rem;
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
                            width: 3.125rem;
                            height: 3.125rem;
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
                              bottom: -0.188rem;
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
