import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { useStatusServices } from "@/hooks/useStatusServices"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme } from "@/shared-module/common/styles"

const StatusServices: React.FC = () => {
  const { t } = useTranslation()
  const { data: services, isLoading, error } = useStatusServices()

  if (isLoading) {
    return <Spinner />
  }

  if (error) {
    return <ErrorBanner error={error} />
  }

  if (!services || services.length === 0) {
    return <p>{t("status-no-services-found")}</p>
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
            <th>{t("status-cluster-ip")}</th>
            <th>{t("status-ports")}</th>
          </tr>
        </thead>
        <tbody>
          {services.map((service) => (
            <tr key={service.name}>
              <td>{service.name}</td>
              <td>{service.cluster_ip || t("status-none")}</td>
              <td>
                {service.ports.length > 0
                  ? service.ports
                      .map(
                        (p) =>
                          `${p.port}${p.target_port ? `:${p.target_port}` : ""}${p.protocol ? `/${p.protocol}` : ""}`,
                      )
                      .join(", ")
                  : t("status-none")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default StatusServices
