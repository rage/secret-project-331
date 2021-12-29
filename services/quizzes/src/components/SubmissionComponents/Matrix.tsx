import { css } from "@emotion/css"
import React from "react"

import { QuizItemSubmissionComponentProps } from "."

const MatrixSubmission: React.FC<QuizItemSubmissionComponentProps> = ({
  public_quiz_item,
  quiz_item_model_solution,
  user_quiz_item_answer,
}) => {
  console.log(public_quiz_item, user_quiz_item_answer, quiz_item_model_solution)

  const findOptionText = (column: number, row: number): string => {
    let text = ""
    if (quiz_item_model_solution) {
      if (quiz_item_model_solution.optionCells !== null) {
        text = quiz_item_model_solution.optionCells[row][column]
      }
    }
    return text
  }

  const tempArray = [0, 1, 2, 3, 4, 5]
  return (
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
          {tempArray.map((row) => {
            return (
              <tr key={`row${row}`}>
                {tempArray.map((column) => {
                  const cellText = findOptionText(column, row)
                  if (cellText !== null) {
                    return (
                      <td
                        key={`cell ${row} ${column}`}
                        className={css`
                          padding: 0;
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
                            ${cellText.length === 0 &&
                            `
                              background-color: #ECECEC;
                            `}
                            ${cellText !== "" &&
                            `
                                background-color: #DBDBDB;
                                `}
                          `}
                        >
                          <p>{cellText}</p>
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
    </table>
  )
}

export default MatrixSubmission
