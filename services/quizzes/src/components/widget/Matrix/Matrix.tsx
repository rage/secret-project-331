import styled from "@emotion/styled"
import React, { useCallback, useEffect, useState } from "react"

import { QuizItemComponentProps } from ".."
import { QuizItemAnswer } from "../../../../types/types"

import MatrixCell from "./MatrixCell"

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

export interface LeftBorderedDivProps {
  correct: boolean | undefined
  direction?: string
  message?: string
}

const Matrix: React.FunctionComponent<React.PropsWithChildren<QuizItemComponentProps>> = ({
  quizItemAnswerState,
  setQuizItemAnswerState,
}) => {
  const [matrixActiveSize, setMatrixActiveSize] = useState<number[]>([]) // [row, column]
  const [matrixVariable, setMatrixVariable] = useState<string[][]>(() => {
    const quizAnswers: string[][] = []
    for (let i = 0; i < 6; i++) {
      const columnArray: string[] = []
      for (let j = 0; j < 6; j++) {
        columnArray.push("")
      }
      quizAnswers.push(columnArray)
    }
    return quizAnswers
  })

  const handleSizeChange = useCallback((matrix: string[][]) => {
    const sizeOfTheMatrix = [0, 0]
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        if (matrix[i][j] !== "" && sizeOfTheMatrix[0] < i) {
          sizeOfTheMatrix[0] = i
        }
        if (matrix[i][j] !== "" && sizeOfTheMatrix[1] < j) {
          sizeOfTheMatrix[1] = j
        }
      }
    }
    setMatrixActiveSize(sizeOfTheMatrix)
    return sizeOfTheMatrix
  }, [])

  useEffect(() => {
    handleSizeChange(matrixVariable)
  }, [handleSizeChange, matrixVariable])

  if (!quizItemAnswerState) {
    return <div></div>
  }
  const handleOptionSelect = (text: string, column: number, row: number) => {
    const newMatrix = matrixVariable.map((rowArray, rowIndex) => {
      return rowArray.map((cell, columnIndex) => {
        if (column === columnIndex && row === rowIndex) {
          return text
        } else {
          return cell
        }
      })
    })
    setMatrixVariable(newMatrix)
    const tempMatrixActiveSize = handleSizeChange(newMatrix)
    let newOptionCells: string[][] = [[]]
    if (newMatrix) {
      newOptionCells = newMatrix
    } else if (quizItemAnswerState?.optionCells) {
      newOptionCells = quizItemAnswerState?.optionCells
    }
    let isValid = null
    for (let i = 0; i <= tempMatrixActiveSize[0]; i++) {
      for (let j = 0; j <= tempMatrixActiveSize[1]; j++) {
        if (newOptionCells[i][j] === "") {
          isValid = false
        }
      }
    }
    if (isValid === null) {
      isValid = true
    }
    const newItemAnswer: QuizItemAnswer = {
      ...quizItemAnswerState,
      optionCells: newOptionCells,
      valid: isValid,
    }
    setQuizItemAnswerState(newItemAnswer)
  }

  const findOptionText = (column: number, row: number): string => {
    return matrixVariable[row][column]
  }

  const tempArray = [0, 1, 2, 3, 4, 5]
  return (
    <>
      <MatrixTableContainer>
        <tbody>
          <>
            {tempArray.map((rowIndex) => {
              return (
                <tr key={`row${rowIndex}`}>
                  {tempArray.map((columnIndex) => {
                    const cellText = findOptionText(columnIndex, rowIndex)
                    if (cellText !== null) {
                      return (
                        <MatrixCell
                          key={`${columnIndex} ${rowIndex}`}
                          column={columnIndex}
                          row={rowIndex}
                          cellText={cellText}
                          handleOptionSelect={handleOptionSelect}
                          matrixSize={matrixActiveSize}
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
      </MatrixTableContainer>
    </>
  )
}

export default Matrix
