import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { faCheckCircle, faTimesCircle } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import React from "react"

import { QuizItemSubmissionComponentProps } from "."

const MatrixTableContainer = styled.table`
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
`

interface isCellCorrectObject {
  text: string
  correct: boolean | undefined
}

const MatrixSubmission: React.FC<React.PropsWithChildren<QuizItemSubmissionComponentProps>> = ({
  quiz_item_model_solution,
  user_quiz_item_answer,
}) => {
  const correctAnswers = quiz_item_model_solution?.optionCells
  const studentAnswers = user_quiz_item_answer.optionCells

  if (!studentAnswers) {
    // eslint-disable-next-line i18next/no-literal-string
    throw new Error("No student answers")
  }

  if (!correctAnswers) {
    // eslint-disable-next-line i18next/no-literal-string
    throw new Error("No correct answers")
  }

  const isMatrixCorrect: boolean[] = []
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      isMatrixCorrect.push(correctAnswers[i][j] === studentAnswers[i][j])
    }
  }
  const includesSingleFalse = isMatrixCorrect.includes(false)

  const findOptionText = (
    column: number,
    row: number,
    isStudent?: boolean,
  ): isCellCorrectObject => {
    let text = ""
    if (isStudent === true) {
      text = studentAnswers[row][column]
      return {
        text,
        correct: studentAnswers[row][column] === correctAnswers[row][column],
      }
    } else {
      return { text: correctAnswers[row][column], correct: true }
    }
  }
  const tempArray = [0, 1, 2, 3, 4, 5]
  if (includesSingleFalse) {
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
            isStudent={true}
            tempArray={tempArray}
            findOptionText={findOptionText}
          ></MatrixTable>
          <FontAwesomeIcon icon={faTimesCircle} color="red" size="lg" />
        </div>
        <div>
          <MatrixTable tempArray={tempArray} findOptionText={findOptionText}></MatrixTable>
          <FontAwesomeIcon icon={faCheckCircle} color="green" size="lg" />
        </div>
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
  findOptionText: (column: number, row: number, isStudent?: boolean) => isCellCorrectObject
  isStudent?: boolean
}

const MatrixTable: React.FC<React.PropsWithChildren<MatrixTableProps>> = ({
  tempArray,
  findOptionText,
  isStudent,
}) => {
  return (
    <MatrixTableContainer>
      <tbody>
        <>
          {tempArray.map((row) => {
            return (
              <tr key={`row${row}`}>
                {tempArray.map((column) => {
                  const cell = findOptionText(column, row, isStudent)
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
                            display: block;
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
                                ${!cell.correct &&
                            `background-color: red;
                                `}
                          `}
                        >
                          <p>{cell.text}</p>
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

export default MatrixSubmission
