"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { DENSITY_COMPACT } from "@/components/credit-registration/constants"
import { useStatusIngresses } from "@/hooks/useStatusIngresses"
import { QueryResult, Table } from "@/shared-module/components"

const StatusIngresses: React.FC = () => {
  const { t } = useTranslation()
  const ingressesQuery = useStatusIngresses()

  return (
    <QueryResult query={ingressesQuery} emptyFallback={<p>{t("status-no-ingresses-found")}</p>}>
      {(ingresses) => (
        <Table
          caption={t("status-ingresses")}
          density={DENSITY_COMPACT}
          rowHover
          rows={ingresses}
          rowKey={(ingress) => ingress.name}
          className={css`
            margin-top: 1rem;
          `}
          columns={[
            { header: t("status-name"), cell: (ingress) => ingress.name },
            { header: t("status-class"), cell: (ingress) => ingress.class_name || "-" },
            {
              header: t("status-hosts"),
              cell: (ingress) => (ingress.hosts.length > 0 ? ingress.hosts.join(", ") : "-"),
            },
            {
              header: t("status-paths"),
              cell: (ingress) =>
                ingress.paths.length > 0 ? (
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
                ),
            },
          ]}
        />
      )}
    </QueryResult>
  )
}

export default StatusIngresses
