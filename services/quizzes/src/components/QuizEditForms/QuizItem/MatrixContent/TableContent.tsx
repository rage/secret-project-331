import { css } from "@emotion/css"
import React, { useEffect, useState } from "react"
import { useDispatch } from "react-redux"

import { MatrixItemAnswer, NormalizedQuizItem } from "../../../../../types/types"
import { createdNewOption, deletedOption } from "../../../../store/editor/editorActions"
import { editedOptionCorrectAnswer } from "../../../../store/editor/options/optionActions"
import { useTypedSelector } from "../../../../store/store"

import TableCellContent from "./TableCellContent"

interface TableContentProps {
  item: NormalizedQuizItem
}

const TableContent: React.FC<TableContentProps> = ({ item }) => {
  const storeOptions = useTypedSelector((state) => state.editor.options)
  const storeItem = useTypedSelector((state) => state.editor.items[item.id])
  const variables = useTypedSelector((state) => state.editor.itemVariables[item.id])
  const dispatch = useDispatch()

  const options = storeItem.options.map((option) => {
    return storeOptions[option]
  })

  const [matrixActiveSize, setMatrixActiveSize] = useState<number[]>([]) // [column, row]
  const [matrixVariable, setMatrixVariable] = useState<MatrixItemAnswer[][]>(() => {
    const quizAnswers: MatrixItemAnswer[][] = []
    for (let j = 0; j < 6; j++) {
      const columnArray: MatrixItemAnswer[] = []
      for (let i = 0; i < 6; i++) {
        const correctColumnOption = options.find(
          (option) => option.row === i && option.column === j,
        )
        if (correctColumnOption) {
          columnArray.push({
            optionId: correctColumnOption.id,
            textData: correctColumnOption.correctAnswer ?? "",
          })
        } else {
          // eslint-disable-next-line i18next/no-literal-string
          columnArray.push({ optionId: "", textData: "" })
        }
      }
      quizAnswers.push(columnArray)
    }
    return quizAnswers
  })

  const handleMatrixSizeChange = React.useCallback(() => {
    const sizeOfTheMatrix = [0, 0]
    for (let j = 0; j < 6; j++) {
      for (let i = 0; i < 6; i++) {
        if (matrixVariable[j][i].textData !== "" && sizeOfTheMatrix[0] < j) {
          sizeOfTheMatrix[0] = j
        }
        if (matrixVariable[j][i].textData !== "" && sizeOfTheMatrix[1] < i) {
          sizeOfTheMatrix[1] = i
        }
      }
    }
    setMatrixActiveSize(sizeOfTheMatrix)
  }, [matrixVariable])

  useEffect(() => {
    handleMatrixSizeChange()
  }, [handleMatrixSizeChange, matrixVariable])

  const checkNeighbourCells = (column: number, row: number) => {
    return matrixVariable[column][row]
  }

  const handleTextarea = (text: string, column: number, row: number) => {
    const option = matrixVariable[column][row]
    if (option.optionId !== "") {
      if (text === "") {
        dispatch(deletedOption(option.optionId, item.id))
        matrixVariable[column][row] = { textData: "", optionId: "" }
      } else {
        dispatch(editedOptionCorrectAnswer(text, option.optionId))
        matrixVariable[column][row].textData = text
      }
    } else {
      const createdStuff = dispatch(createdNewOption(storeItem.id, "", column, row))
      if (createdStuff) {
        matrixVariable[column][row] = { optionId: createdStuff.payload.optionId, textData: text }
        setMatrixVariable(matrixVariable)
        dispatch(editedOptionCorrectAnswer(text, createdStuff.payload.optionId))
      }
    }
    handleMatrixSizeChange()
  }

  const tempArray = [0, 1, 2, 3, 4, 5]
  return (
    <>
      <table
        className={css`
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
            {tempArray.map((rowIndex) => (
              <tr key={`row ${rowIndex}`}>
                {tempArray.map((columnIndex) => {
                  const checkNeighbour = checkNeighbourCells(columnIndex, rowIndex)
                  return (
                    <>
                      {checkNeighbour !== null ? (
                        <TableCellContent
                          matrixSize={matrixActiveSize}
                          option={checkNeighbour}
                          columnLoop={columnIndex}
                          rowLoop={rowIndex}
                          variables={variables}
                          handleTextarea={handleTextarea}
                        >
                          {" "}
                        </TableCellContent>
                      ) : null}
                    </>
                  )
                })}
              </tr>
            ))}
          </>
        </tbody>
      </table>
    </>
  )
}

export default TableContent
