import styled from "@emotion/styled"
import React, { useCallback, useEffect, useMemo, useState } from "react"

import { QuizItemComponentProps } from ".."
import { UserItemAnswerMatrix } from "../../../../../../types/quizTypes/answer"
import { PublicSpecQuizItemMatrix } from "../../../../../../types/quizTypes/publicSpec"
import withErrorBoundary from "../../../../../shared-module/utils/withErrorBoundary"

import MatrixCell from "./MatrixCell"

const MatrixTableContainer = styled.table`
  margin: auto;
  margin-top: 1rem;
  background-color: #e2e4e6;
  border-collapse: collapse;
  td {
    border: 2px solid #e1e1e199;
  }

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
`

export interface LeftBorderedDivProps {
  correct: boolean | undefined
  direction?: string
  message?: string
}

const Matrix: React.FunctionComponent<
  QuizItemComponentProps<PublicSpecQuizItemMatrix, UserItemAnswerMatrix>
> = ({ quizItem, quizItemAnswerState, setQuizItemAnswerState }) => {
  const [matrixActiveSize, setMatrixActiveSize] = useState<number[]>([]) // [row, column]
  const matrixVariable = useMemo(() => {
    const res = quizItemAnswerState?.matrix
    if (res !== null && res !== undefined && Array.isArray(res)) {
      return res
    }
    // Initialize a new empty answer
    const newAnswerMatrix: string[][] = []
    for (let i = 0; i < 6; i++) {
      const columnArray: string[] = []
      for (let j = 0; j < 6; j++) {
        columnArray.push("")
      }
      newAnswerMatrix.push(columnArray)
    }
    return newAnswerMatrix
  }, [quizItemAnswerState?.matrix])
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
    const tempMatrixActiveSize = handleSizeChange(newMatrix)
    let newOptionCells: string[][] = [[]]
    if (newMatrix) {
      newOptionCells = newMatrix
    } else if (quizItemAnswerState?.matrix) {
      newOptionCells = quizItemAnswerState?.matrix
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
    if (!quizItemAnswerState) {
      setQuizItemAnswerState({
        quizItemId: quizItem.id,
        type: "matrix",
        matrix: newOptionCells,
        valid: isValid,
      })
      return
    }
    const newItemAnswer: UserItemAnswerMatrix = {
      ...quizItemAnswerState,
      matrix: newOptionCells,
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
                        ></MatrixCell>
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

export default withErrorBoundary(Matrix)
