"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { DENSITY_COMPACT } from "@/components/credit-registration/constants"
import { useStatusServices } from "@/hooks/useStatusServices"
import { QueryResult, Table } from "@/shared-module/components"

const StatusServices: React.FC = () => {
  const { t } = useTranslation()
  const servicesQuery = useStatusServices()

  return (
    <QueryResult query={servicesQuery} emptyFallback={<p>{t("status-no-services-found")}</p>}>
      {(services) => (
        <Table
          caption={t("status-services")}
          density={DENSITY_COMPACT}
          rowHover
          rows={services}
          rowKey={(service) => service.name}
          className={css`
            margin-top: 1rem;
          `}
          columns={[
            { header: t("status-name"), cell: (service) => service.name },
            {
              header: t("status-cluster-ip"),
              cell: (service) => service.cluster_ip || t("status-none"),
            },
            {
              header: t("status-ports"),
              cell: (service) =>
                service.ports.length > 0
                  ? service.ports
                      .map(
                        (p) =>
                          `${p.port}${p.target_port ? `:${p.target_port}` : ""}${p.protocol ? `/${p.protocol}` : ""}`,
                      )
                      .join(", ")
                  : t("status-none"),
            },
          ]}
        />
      )}
    </QueryResult>
  )
}

export default StatusServices
