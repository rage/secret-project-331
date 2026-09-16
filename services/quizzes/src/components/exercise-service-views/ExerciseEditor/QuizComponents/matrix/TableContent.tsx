import styled from "@emotion/styled"
import React, { useEffect, useState } from "react"

import { emptyMatrixGrid, MATRIX_GRID_SIZE, matrixShape } from "@/util/matrix"

import type { PrivateSpecQuizItemMatrix } from "../../../../../../types/quizTypes/privateSpec"
import useQuizzesExerciseServiceOutputState from "../../../../../hooks/useQuizzesExerciseServiceOutputState"
import findQuizItem from "../../utils/general"
import TableCellContent from "./TableCellContent"

const MatrixTableContainer = styled.table`
  margin: auto;
  background-color: #f5f6f7;
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

interface TableContentProps {
  quizItemId: string // PrivateSpecQuizItemMatrix
}

const TableContent: React.FC<React.PropsWithChildren<TableContentProps>> = ({ quizItemId }) => {
  const { selected, updateState } = useQuizzesExerciseServiceOutputState<PrivateSpecQuizItemMatrix>(
    (quiz) => {
      // oxlint-disable-next-line i18next/no-literal-string
      return findQuizItem<PrivateSpecQuizItemMatrix>(quiz, quizItemId, "matrix")
    },
  )
  const [matrixActiveSize, setMatrixActiveSize] = useState<number[]>([]) // [row, column]
  const [matrixVariable, setMatrixVariable] = useState<string[][]>(() => {
    if (selected && selected.optionCells) {
      return selected.optionCells
    }
    return emptyMatrixGrid()
  })

  // The frame is drawn from the last non-blank row and column, so it is expressed as indices while
  // `matrixShape` counts cells. It must agree with the grader, or the teacher sees a frame that is
  // not the one their students are graded against.
  useEffect(() => {
    const shape = matrixShape(matrixVariable)
    setMatrixActiveSize([Math.max(0, shape.rows - 1), Math.max(0, shape.columns - 1)])
  }, [matrixVariable])

  const checkNeighbourCells = (column: number, row: number) => {
    return matrixVariable[row]?.[column] ?? ""
  }

  const handleTextarea = (text: string, column: number, row: number) => {
    const newMatrix = matrixVariable.map((rowArray, rowIndex) => {
      return rowArray.map((cell, columnIndex) => {
        if (column === columnIndex && row === rowIndex) {
          return text
        }
        return cell
      })
    })
    setMatrixVariable(newMatrix)
    updateState((draft) => {
      if (!draft) {
        return
      }
      draft.optionCells = newMatrix
    })
  }

  const tempArray = Array.from({ length: MATRIX_GRID_SIZE }, (_unused, index) => index)
  return (
    <MatrixTableContainer>
      <tbody>
        {tempArray.map((rowIndex) => (
          <tr key={`row ${rowIndex}`}>
            {tempArray.map((columnIndex) => {
              const checkNeighbour = checkNeighbourCells(columnIndex, rowIndex)
              return checkNeighbour !== null ? (
                <TableCellContent
                  key={`row ${rowIndex} column: ${columnIndex}`}
                  matrixSize={matrixActiveSize}
                  cellText={checkNeighbour}
                  columnLoop={columnIndex}
                  rowLoop={rowIndex}
                  handleTextarea={handleTextarea}
                />
              ) : null
            })}
          </tr>
        ))}
      </tbody>
    </MatrixTableContainer>
  )
}

export default TableContent
