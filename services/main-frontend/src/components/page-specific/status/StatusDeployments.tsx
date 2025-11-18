import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { useStatusDeployments } from "../../../hooks/useStatusDeployments"

import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"

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
            border-bottom: 1px solid #ddd;
          }

          th {
            background-color: #f5f5f5;
            font-weight: 600;
          }

          tr:hover {
            background-color: #f9f9f9;
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
                  ${!isHealthy ? "background-color: #fff3cd;" : ""}
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
                    <span
                      className={css`
                        font-weight: 600;
                        color: ${isHealthy ? "#28a745" : "#dc3545"};
                      `}
                    >
                      {deployment.ready_replicas}/{deployment.replicas}
                    </span>
                    <div
                      className={css`
                        flex: 1;
                        max-width: 200px;
                        height: 8px;
                        background-color: #e9ecef;
                        border-radius: 4px;
                        overflow: hidden;
                      `}
                    >
                      <div
                        className={css`
                          height: 100%;
                          width: ${readinessPercent}%;
                          background-color: ${isHealthy ? "#28a745" : "#dc3545"};
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
