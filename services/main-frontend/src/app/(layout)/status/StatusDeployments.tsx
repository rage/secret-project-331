"use client"

import { css } from "@emotion/css"
import { CheckCircle, ExclamationTriangle } from "@vectopus/atlas-icons-react"
import React from "react"
import { useTranslation } from "react-i18next"

import { DENSITY_COMPACT } from "@/components/credit-registration/constants"
import { useStatusDeployments } from "@/hooks/useStatusDeployments"
import { baseTheme } from "@/shared-module/common/styles"
import { QueryResult, Table } from "@/shared-module/components"

const StatusDeployments: React.FC = () => {
  const { t } = useTranslation()
  const deploymentsQuery = useStatusDeployments()

  return (
    <QueryResult query={deploymentsQuery} emptyFallback={<p>{t("status-no-deployments-found")}</p>}>
      {(deployments) => (
        <Table
          caption={t("status-deployments")}
          density={DENSITY_COMPACT}
          rowHover
          rows={deployments}
          rowKey={(deployment) => deployment.name}
          className={css`
            margin-top: 1rem;
          `}
          columns={[
            { header: t("status-name"), cell: (deployment) => deployment.name },
            {
              header: t("status-ready-replicas"),
              cell: (deployment) => {
                const isHealthy =
                  deployment.ready_replicas === deployment.replicas && deployment.replicas > 0
                const readinessPercent =
                  deployment.replicas > 0
                    ? (deployment.ready_replicas / deployment.replicas) * 100
                    : 0
                return (
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
                        color: ${
                          isHealthy ? baseTheme.colors.green[600] : baseTheme.colors.red[600]
                        };
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
                          background-color: ${
                            isHealthy ? baseTheme.colors.green[600] : baseTheme.colors.red[600]
                          };
                          transition: width 0.3s ease;
                        `}
                      />
                    </div>
                  </div>
                )
              },
            },
            { header: t("status-total-replicas"), cell: (deployment) => deployment.replicas },
          ]}
        />
      )}
    </QueryResult>
  )
}

export default StatusDeployments
