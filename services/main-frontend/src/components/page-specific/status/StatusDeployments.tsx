import { css } from "@emotion/css"
import { CheckCircle, ExclamationTriangle } from "@vectopus/atlas-icons-react"
import React from "react"
import { useTranslation } from "react-i18next"

import { useStatusDeployments } from "../../../hooks/useStatusDeployments"

import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme } from "@/shared-module/common/styles"

const StatusDeployments: React.FC = () => {
  const { t } = useTranslation()
  const { data: deployments, isLoading, error } = useStatusDeployments()

  if (isLoading) {
    return <Spinner />
  }

  if (error) {
    return <ErrorBanner error={error} />
  }

  if (!deployments || deployments.length === 0) {
    return <p>{t("status-no-deployments-found")}</p>
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
            <th>{t("status-ready-replicas")}</th>
            <th>{t("status-total-replicas")}</th>
          </tr>
        </thead>
        <tbody>
          {deployments.map((deployment) => {
            const isHealthy =
              deployment.ready_replicas === deployment.replicas && deployment.replicas > 0
            const readinessPercent =
              deployment.replicas > 0 ? (deployment.ready_replicas / deployment.replicas) * 100 : 0
            return (
              <tr
                key={deployment.name}
                className={css`
                  ${!isHealthy ? `background-color: ${baseTheme.colors.yellow[100]};` : ""}
                `}
              >
                <td>{deployment.name}</td>
                <td>
                  <div
                    className={css`
                      display: flex;
                      align-items: center;
                      gap: 0.5rem;
                    `}
                  >
                    {isHealthy ? (
                      <CheckCircle size={16} color={baseTheme.colors.green[600]} />
                    ) : (
                      <ExclamationTriangle size={16} color={baseTheme.colors.red[600]} />
                    )}
                    <span
                      className={css`
                        font-weight: 600;
                        color: ${isHealthy
                          ? baseTheme.colors.green[600]
                          : baseTheme.colors.red[600]};
                      `}
                    >
                      {deployment.ready_replicas}/{deployment.replicas}
                    </span>
                    <div
                      className={css`
                        flex: 1;
                        max-width: 200px;
                        height: 8px;
                        background-color: ${baseTheme.colors.clear[300]};
                        border-radius: 4px;
                        overflow: hidden;
                      `}
                    >
                      <div
                        className={css`
                          height: 100%;
                          width: ${readinessPercent}%;
                          background-color: ${isHealthy
                            ? baseTheme.colors.green[600]
                            : baseTheme.colors.red[600]};
                          transition: width 0.3s ease;
                        `}
                      />
                    </div>
                  </div>
                </td>
                <td>{deployment.replicas}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default StatusDeployments
