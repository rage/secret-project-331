import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { faCheckCircle, faTimesCircle } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import React from "react"

import { UserItemAnswerMatrix } from "../../../types/quizTypes/answer"
import { PublicSpecQuizItemMatrix } from "../../../types/quizTypes/publicSpec"
import { baseTheme } from "../../shared-module/styles"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"

import { QuizItemSubmissionComponentProps } from "."

const MatrixTableContainer = styled.table`
  margin: auto;
  margin-top: 1rem;
  background-color: gray;
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
`

interface isCellCorrectObject {
  text: string
  correct: boolean | null
}

const MatrixSubmission: React.FC<
  QuizItemSubmissionComponentProps<PublicSpecQuizItemMatrix, UserItemAnswerMatrix>
> = ({ quiz_item_model_solution, user_quiz_item_answer, quiz_item_feedback }) => {
  const modelSolution = quiz_item_model_solution as UserItemAnswerMatrix | null
  const correctAnswers = modelSolution?.matrix
  const studentAnswers = user_quiz_item_answer.matrix

  if (!studentAnswers) {
    // eslint-disable-next-line i18next/no-literal-string
    throw new Error("No student answers")
  }

  const isIncorrect = !quiz_item_feedback?.quiz_item_correct

  const findOptionText = (
    column: number,
    row: number,
    isStudentsAnswer: boolean,
  ): isCellCorrectObject => {
    if (!correctAnswers) {
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
  const tempArray = [0, 1, 2, 3, 4, 5]
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
            tempArray={tempArray}
            findOptionText={findOptionText}
          ></MatrixTable>
          {correctAnswers && <FontAwesomeIcon icon={faTimesCircle} color="red" size="lg" />}
        </div>
        {correctAnswers && (
          <div>
            <MatrixTable tempArray={tempArray} findOptionText={findOptionText}></MatrixTable>
            <FontAwesomeIcon icon={faCheckCircle} color="green" size="lg" />
          </div>
        )}
      </div>
    )
  } else {
    return (
      <MatrixTable
        // eslint-disable-next-line i18next/no-literal-string
        aria-label="single"
        tempArray={tempArray}
        findOptionText={findOptionText}
      ></MatrixTable>
    )
  }
}

interface MatrixTableProps {
  tempArray: number[]
  findOptionText: (column: number, row: number, isStudentsAnswer: boolean) => isCellCorrectObject
  isStudentsAnswer?: boolean
}

const MatrixTable: React.FC<React.PropsWithChildren<MatrixTableProps>> = ({
  tempArray,
  findOptionText,
  isStudentsAnswer = false,
}) => {
  return (
    <MatrixTableContainer>
      <tbody>
        <>
          {tempArray.map((row) => {
            return (
              <tr key={`row${row}`}>
                {tempArray.map((column) => {
                  const cell = findOptionText(column, row, isStudentsAnswer)
                  if (cell !== null) {
                    return (
                      <td
                        key={`cell ${row} ${column}`}
                        className={css`
                          padding: 0;
                          font-size: 2.8vw;
                          font-size: 22px;
                          font-family: Josefin Sans, sans-serif;
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
                              background-color: #ECECEC;
                            `}
                            ${cell.text !== "" &&
                            `
                                background-color: #DBDBDB;
                                `}
                                ${cell.correct === false &&
                            `background-color: ${baseTheme.colors.red[200]};
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
