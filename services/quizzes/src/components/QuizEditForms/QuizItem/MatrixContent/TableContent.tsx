/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import { Table, TableBody, TableCell, TableRow, TextField } from "@material-ui/core"
import React from "react"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"
import styled from "styled-components"

import { NormalizedQuizItem, NormalizedQuizItemOption } from "../../../../../types/types"
import { createdNewOption } from "../../../../store/editor/editorActions"
import { setMatrixCellValue } from "../../../../store/editor/itemVariables/itemVariableActions"
import { useTypedSelector } from "../../../../store/store"
import { ModalContent } from "../../../Shared/Modal"

import MatrixButton from "./MatrixChoiceButton"

const QuizContent = styled.div`
  padding: 1rem;
  display: flex;
  @media only screen and (max-width: 600px) {
    width: 100%;
  }
`

const ValueFieldContainer = styled(TextField)`
  width: 100%;
`

interface TableContentProps {
  item: NormalizedQuizItem
}

const TableContent: React.FC<TableContentProps> = ({ item }) => {
  const { t } = useTranslation()
  const storeOptions = useTypedSelector((state) => state.editor.options)
  const storeItem = useTypedSelector((state) => state.editor.items[item.id])
  const variables = useTypedSelector((state) => state.editor.itemVariables[item.id])

  const dispatch = useDispatch()

  const handleAddingNewCell = (text: string, column: number, row: number) => {
    if (text.length > 0) {
      dispatch(setMatrixCellValue(storeItem.id, text, column, row))
      dispatch(createdNewOption(storeItem.id, text, column, row))
    }
  }

  function compareRow(a: NormalizedQuizItemOption, b: NormalizedQuizItemOption) {
    if (a.row < b.row) {
      return -1
    }
    if (a.row > b.row) {
      return 1
    }
    return 0
  }

  function compareColumn(a: NormalizedQuizItemOption, b: NormalizedQuizItemOption) {
    if (a.column < b.column && a.row < b.row) {
      return -1
    }
    if (a.column > b.column && a.row < b.row) {
      return 1
    }
    return 0
  }

  const options = storeItem.options.map((option) => {
    return storeOptions[option]
  })

  const optionsOrderedByRow = options.sort(compareRow)

  const optionsOrderedByColumn = optionsOrderedByRow.sort(compareColumn)

  const rowAmount = optionsOrderedByColumn.filter((a) => a.column === 0)

  const checkNeighbourCells = (column: number, row: number) => {
    const optionsMapped = options.find((option) => {
      if (
        (option.column === column - 1 && option.row === row) ||
        (option.column === column + 1 && option.row === row) ||
        (option.column === column && option.row === row - 1) ||
        (option.column === column && option.row === row)
      ) {
        return true
      }
    })
    console.log(optionsMapped)
    return optionsMapped
  }

  const tempArray = [2, 3, 4, 5, 6, 7]

  console.log(options)
  return (
    <>
      {storeItem.options.map((option, i) => (
        <QuizContent key={option}>
          <MatrixButton index={i + 1} option={storeOptions[option]} />
        </QuizContent>
      ))}
      <h2>{t("matrix-option-editor-title")}</h2>
      <Table width="auto">
        <TableBody>
          {rowAmount.length > 0 ? (
            <>
              {tempArray.map((firstLoop, rowIndex) => (
                <TableRow key={`row index: ${rowIndex}`} id="wow">
                  {tempArray.map((secondLoop, columnIndex) => (
                    <>
                      {checkNeighbourCells(columnIndex, rowIndex) !== undefined ? (
                        <>
                          <TableCell
                            key={`row index: , ${firstLoop} column index: , ${secondLoop}`}
                            align="left"
                            component="th"
                            scope="row"
                            max-width={40}
                            padding="none"
                          >
                            <ModalContent
                              className={css`
                                padding: 0 !important;
                              `}
                            >
                              <ValueFieldContainer
                                type="text"
                                value={variables.textValue ?? ""}
                                label={`row: ${rowIndex}, column: ${columnIndex}`}
                                fullWidth
                                variant="outlined"
                                onChange={(event) =>
                                  handleAddingNewCell(event.target.value, columnIndex, rowIndex)
                                }
                              />
                            </ModalContent>
                          </TableCell>
                        </>
                      ) : null}
                    </>
                  ))}
                </TableRow>
              ))}
            </>
          ) : (
            <>
              <TableRow>
                <>
                  <TableCell align="left" component="th" scope="row" max-width={40} padding="none">
                    <ModalContent
                      className={css`
                        padding: 0 !important;
                      `}
                    >
                      <ValueFieldContainer
                        type="text"
                        value={variables.textValue ?? ""}
                        fullWidth
                        variant="outlined"
                        onChange={(event) => handleAddingNewCell(event.target.value, 0, 0)}
                      />
                    </ModalContent>
                  </TableCell>
                </>
              </TableRow>{" "}
            </>
          )}
        </TableBody>
      </Table>
    </>
  )
}

export default TableContent
