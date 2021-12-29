import { css } from "@emotion/css"
import React, { useEffect, useState } from "react"
import { useDispatch } from "react-redux"

import { NormalizedQuizItem } from "../../../../../types/types"
import { editedQuizItemOptionCells } from "../../../../store/editor/items/itemAction"
import { useTypedSelector } from "../../../../store/store"

import TableCellContent from "./TableCellContent"

interface TableContentProps {
  item: NormalizedQuizItem
}

const TableContent: React.FC<TableContentProps> = ({ item }) => {
  const variables = useTypedSelector((state) => state.editor.itemVariables[item.id])
  const dispatch = useDispatch()

  const [matrixActiveSize, setMatrixActiveSize] = useState<number[]>([]) // [column, row]
  const [matrixVariable, setMatrixVariable] = useState<string[][]>(() => {
    if (item.optionCells) {
      return item.optionCells
    }
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

  useEffect(() => {
    const sizeOfTheMatrix = [0, 0]
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        if (matrixVariable[i][j] !== "" && sizeOfTheMatrix[0] < i) {
          sizeOfTheMatrix[0] = i
        }
        if (matrixVariable[i][j] !== "" && sizeOfTheMatrix[1] < j) {
          sizeOfTheMatrix[1] = j
        }
      }
    }
    setMatrixActiveSize(sizeOfTheMatrix)
  }, [matrixVariable])

  const checkNeighbourCells = (column: number, row: number) => {
    return matrixVariable[row][column]
  }

  const handleTextarea = (text: string, column: number, row: number) => {
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
    dispatch(editedQuizItemOptionCells(item.id, newMatrix))
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
                          key={`row ${rowIndex} column: ${columnIndex}`}
                          matrixSize={matrixActiveSize}
                          cellText={checkNeighbour}
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
