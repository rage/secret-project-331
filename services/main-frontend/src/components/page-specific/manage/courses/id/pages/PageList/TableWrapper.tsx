import { css, cx } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { baseTheme } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

const TableWrapper: React.FC<React.PropsWithChildren<{ className?: string }>> = ({
  children,
  className,
}) => {
  const { t } = useTranslation()
  return (
    <div
      className={cx(
        css`
          overflow-x: scroll;
          width: 100%;
          ${respondToOrLarger.sm} {
            overflow-x: visible;
          }
        `,
        className,
      )}
    >
      <table
        className={css`
          width: 100%;
          border-collapse: separate;
          border-spacing: 0 1rem;

          thead {
            td {
              padding-bottom: 0;
              font-weight: 500;
              font-size: 1rem;
              line-height: 1rem;
              color: ${baseTheme.colors.gray[500]};
            }
          }

          tbody {
            td {
              padding: 0.75rem 1rem;
            }

            td {
              background-color: ${baseTheme.colors.clear[100]};
            }

            tr td:first-child {
              border-top-left-radius: 4px;
            }

            tr td:last-child {
              border-top-right-radius: 4px;
            }

            tr td:first-child {
              border-bottom-left-radius: 4px;
            }

            tr td:last-child {
              border-bottom-right-radius: 4px;
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
