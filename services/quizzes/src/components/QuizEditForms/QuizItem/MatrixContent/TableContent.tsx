/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import React from "react"
import { useDispatch } from "react-redux"

import { NormalizedQuizItem } from "../../../../../types/types"
import { createdNewOption } from "../../../../store/editor/editorActions"
import { useTypedSelector } from "../../../../store/store"

import TableCellOptionContent from "./TableCellOptionContent"

interface TableContentProps {
  item: NormalizedQuizItem
}

const TableContent: React.FC<TableContentProps> = ({ item }) => {
  const storeOptions = useTypedSelector((state) => state.editor.options)
  const storeItem = useTypedSelector((state) => state.editor.items[item.id])
  const variables = useTypedSelector((state) => state.editor.itemVariables[item.id])
  const dispatch = useDispatch()

  /*
  const handleAddingNewCell = (column: number, row: number) => {
    console.log(storeOptions)
    dispatch(createdNewOption(storeItem.id, "", column, row))
  }
  */
  if (storeItem.options.length < 1) {
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        dispatch(createdNewOption(storeItem.id, "", i, j))
      }
    }
  }
  /*
  function compareRow(a: NormalizedQuizItemOption, b: NormalizedQuizItemOption) {
    if (a.row === null || b.row === null) {
      return 0
    }
    if (a.row < b.row) {
      return -1
    }
    if (a.row > b.row) {
      return 1
    }
    return 0
  }

  function compareColumn(a: NormalizedQuizItemOption, b: NormalizedQuizItemOption) {
    if (a.column === null || b.column === null) {
      return 0
    }
    if (a.row === null || b.row === null) {
      return 0
    }
    if (a.column < b.column && a.row < b.row) {
      return -1
    }
    if (a.column > b.column && a.row < b.row) {
      return 1
    }
    return 0
  }
*/
  const options = storeItem.options.map((option) => {
    return storeOptions[option]
  })

  //const optionsOrderedByRow = options.sort(compareRow)

  //const optionsOrderedByColumn = optionsOrderedByRow.sort(compareColumn)

  //const rowAmount = optionsOrderedByColumn.filter((a) => a.column === 0)

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
          border-collapse: collapse;
          padding: 0;
        `}
      >
        <tbody>
          <>
            {tempArray.map((rowIndex) => (
              <tr key={`row index: ${rowIndex}`} id="wow">
                {tempArray.map((columnIndex) => {
                  const checkNeighbour = checkNeighbourCells(columnIndex, rowIndex)
                  console.log(checkNeighbour)
                  return (
                    <>
                      <>
                        {
                          checkNeighbour !== null ? (
                            <TableCellOptionContent
                              option={checkNeighbour}
                              columnLoop={columnIndex}
                              rowLoop={rowIndex}
                              variables={variables}
                            >
                              {" "}
                            </TableCellOptionContent>
                          ) : null /*: (
                          <TableCellContent
                            option={checkNeighbour}
                            columnLoop={columnIndex}
                            rowLoop={rowIndex}
                            variables={variables}
                            handleAddingNewCell={handleAddingNewCell}
                          >
                            {" "}
                          </TableCellContent>
                        )*/
                        }
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
