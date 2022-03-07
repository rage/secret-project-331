import { css } from "@emotion/css"
import React from "react"

import { baseTheme } from "../../../../../../../shared-module/styles"

const TableWrapper: React.FC = ({ children }) => {
  return (
    <table
      className={css`
        width: 100%;
        border-collapse: separate;
        border-spacing: 0 1rem;

        td {
          padding: 1rem;
        }

        thead {
          td {
            padding-bottom: 0;
            font-weight: 600;
            font-size: 16px;
            line-height: 16px;
            color: ${baseTheme.colors.grey[400]};
          }
        }
      `}
    >
      <thead>
        <tr>
          <td>Title</td>
          <td>URL path</td>
          <td aria-label="Actions"></td>
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  )
}

export default TableWrapper
