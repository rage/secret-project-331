import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { baseTheme } from "../../../../../../../shared-module/styles"

const TableWrapper: React.FC<React.PropsWithChildren<unknown>> = ({ children }) => {
  const { t } = useTranslation()
  return (
    <div
      className={css`
        overflow-x: scroll;
        width: 100%;
      `}
    >
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
              color: ${baseTheme.colors.grey[500]};
            }
          }
        `}
      >
        <thead>
          <tr>
            <td>{t("label-title")}</td>
            <td>{t("label-url-path")}</td>
            <td>{t("label-hidden")}</td>
            <td aria-label={t("label-actions")}></td>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export default TableWrapper
