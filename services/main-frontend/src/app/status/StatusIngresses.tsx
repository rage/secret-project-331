"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { useStatusIngresses } from "@/hooks/useStatusIngresses"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme } from "@/shared-module/common/styles"

const StatusIngresses: React.FC = () => {
  const { t } = useTranslation()
  const { data: ingresses, isLoading, error } = useStatusIngresses()

  if (isLoading) {
    return <Spinner />
  }

  if (error) {
    return <ErrorBanner error={error} />
  }

  if (!ingresses || ingresses.length === 0) {
    return <p>{t("status-no-ingresses-found")}</p>
  }

  return (
    <div
      className={css`
        overflow-x: auto;
      `}
    >
      <table
        className={css`
          width: 100%;
          border-collapse: collapse;
          margin-top: 1rem;

          th,
          td {
            padding: 0.5rem;
            text-align: left;
            border-bottom: 1px solid ${baseTheme.colors.clear[300]};
          }

          th {
            background-color: ${baseTheme.colors.clear[100]};
            font-weight: 600;
          }

          tr:hover {
            background-color: ${baseTheme.colors.clear[200]};
          }
        `}
      >
        <thead>
          <tr>
            <th>{t("status-name")}</th>
            <th>{t("status-class")}</th>
            <th>{t("status-hosts")}</th>
            <th>{t("status-paths")}</th>
          </tr>
        </thead>
        <tbody>
          {ingresses.map((ingress) => (
            <tr key={ingress.name}>
              <td>{ingress.name}</td>
              <td>{ingress.class_name || "-"}</td>
              <td>{ingress.hosts.length > 0 ? ingress.hosts.join(", ") : "-"}</td>
              <td>
                {ingress.paths.length > 0 ? (
                  <ul
                    className={css`
                      margin: 0;
                      padding-left: 1.5rem;
                    `}
                  >
                    {ingress.paths.map((path, idx) => (
                      <li key={idx}>{path}</li>
                    ))}
                  </ul>
                ) : (
                  "-"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default StatusIngresses
