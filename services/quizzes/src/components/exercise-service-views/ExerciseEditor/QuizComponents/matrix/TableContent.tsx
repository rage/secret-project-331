import React, { useEffect, useState } from "react"

import { MatrixGridCell, MatrixTable, useIsEditingGrid } from "@/components/Shared/MatrixGrid"
import {
  blankCellsInsideShape,
  emptyMatrixGrid,
  MATRIX_GRID_SIZE,
  matrixShape,
} from "@/util/matrix"

import type { PrivateSpecQuizItemMatrix } from "../../../../../../types/quizTypes/privateSpec"
import useQuizzesExerciseServiceOutputState from "../../../../../hooks/useQuizzesExerciseServiceOutputState"
import findQuizItem from "../../utils/general"

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
  const [isEditing, editingHandlers] = useIsEditingGrid()
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

  // The key-gap warning in MatrixGradingSettings explains these; the grid only marks them
  const gaps = isEditing ? [] : blankCellsInsideShape(matrixVariable, matrixShape(matrixVariable))
  const isGap = (row: number, column: number) =>
    gaps.some((gap) => gap.row === row && gap.column === column)

  const tempArray = Array.from({ length: MATRIX_GRID_SIZE }, (_unused, index) => index)
  return (
    <MatrixTable {...editingHandlers}>
      <tbody>
        {tempArray.map((rowIndex) => (
          <tr key={`row ${rowIndex}`}>
            {tempArray.map((columnIndex) => (
              <MatrixGridCell
                key={`row ${rowIndex} column: ${columnIndex}`}
                matrixSize={matrixActiveSize}
                cellText={checkNeighbourCells(columnIndex, rowIndex)}
                column={columnIndex}
                row={rowIndex}
                onChange={handleTextarea}
                isGap={isGap(rowIndex, columnIndex)}
              />
            ))}
          </tr>
        ))}
      </tbody>
    </MatrixTable>
  )
}

export default TableContent
