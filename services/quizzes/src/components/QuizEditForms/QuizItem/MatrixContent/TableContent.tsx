import { css } from "@emotion/css"
import React from "react"
import { useDispatch } from "react-redux"

import { NormalizedQuizItem } from "../../../../../types/types"
import { createdNewOption } from "../../../../store/editor/editorActions"
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

  if (storeItem.options.length < 1) {
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        dispatch(createdNewOption(storeItem.id, "", i, j))
      }
    }
  }
  const options = storeItem.options.map((option) => {
    return storeOptions[option]
  })

  const checkNeighbourCells = (column: number, row: number) => {
    const findOption = options.find((option) => option.column === column && option.row === row)

    if (findOption !== undefined) {
      return findOption
    } else {
      return null
    }
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
                  console.log(checkNeighbour)
                  return (
                    <>
                      <>
                        {checkNeighbour !== null ? (
                          <TableCellContent
                            option={checkNeighbour}
                            columnLoop={columnIndex}
                            rowLoop={rowIndex}
                            variables={variables}
                          >
                            {" "}
                          </TableCellContent>
                        ) : null}
                      </>
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
