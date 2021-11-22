/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import { styled, TableCell, TextField } from "@material-ui/core"
import React from "react"

import { QuizItemVariables } from "../../../../../types/types"
import { ModalContent } from "../../../Shared/Modal"

interface TableCellContentProps {
  rowLoop: number
  columnLoop: number
  variables: QuizItemVariables
  variation: string
  handleAddingNewCell: (text: string, column: number, row: number) => void
}

const ValueFieldContainer = styled(TextField)`
  width: 100%;
`

const TableCellContent: React.FC<TableCellContentProps> = ({
  columnLoop,
  rowLoop,
  variables,
  variation,
  handleAddingNewCell,
}) => {
  return (
    <>
      <TableCell
        key={`row index: , ${rowLoop} column index: , ${columnLoop}`}
        align="left"
        component="th"
        scope="row"
        max-width={40}
        padding="none"
        className={css`
          ${variation === "neighbour" &&
          `
          opacity: 50%;`}
        `}
      >
        <ModalContent
          className={css`
            padding: 0 !important;
          `}
        >
          <ValueFieldContainer
            type="text"
            value={variables.textValue ?? ""}
            label={`row: ${rowLoop}, column: ${columnLoop}`}
            fullWidth
            variant="outlined"
            onChange={(event) => handleAddingNewCell(event.target.value, columnLoop, rowLoop)}
          />
        </ModalContent>
      </TableCell>
    </>
  )
}
export default TableCellContent
