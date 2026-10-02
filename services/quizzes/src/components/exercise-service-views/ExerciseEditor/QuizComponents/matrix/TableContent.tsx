import React, { useState } from "react"

import { MatrixInputGrid, useMatrixGrid } from "@/components/Shared/MatrixGrid"
import { emptyMatrixGrid } from "@/util/matrix"

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
  const [matrixVariable, setMatrixVariable] = useState<string[][]>(
    () => selected?.optionCells ?? emptyMatrixGrid(),
  )
  // The key-gap warning in MatrixGradingSettings explains these; the grid only marks them
  const { shape, gaps, editingHandlers } = useMatrixGrid(matrixVariable)

  const handleMatrixChange = (newMatrix: string[][]) => {
    setMatrixVariable(newMatrix)
    updateState((draft) => {
      if (!draft) {
        return
      }
      draft.optionCells = newMatrix
    })
  }

  return (
    <MatrixInputGrid
      matrix={matrixVariable}
      shape={shape}
      gaps={gaps}
      onMatrixChange={handleMatrixChange}
      {...editingHandlers}
    />
  )
}

export default TableContent
