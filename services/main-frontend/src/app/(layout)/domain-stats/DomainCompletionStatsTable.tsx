"use client"

import type { UseQueryResult } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { DENSITY_COMPACT } from "@/components/credit-registration/constants"
import type { DomainCompletionStats } from "@/generated/api/types.generated"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Button, QueryResult, Table } from "@/shared-module/components"

interface DomainCompletionStatsTableProps {
  query: UseQueryResult<DomainCompletionStats[]>
  onDomainSelect: (domain: string) => void
}

const DomainCompletionStatsTable: React.FC<DomainCompletionStatsTableProps> = ({
  query,
  onDomainSelect,
}) => {
  const { t } = useTranslation()

  const renderTable = (data: DomainCompletionStats[]) => (
    <Table
      caption={t("email-domain")}
      density={DENSITY_COMPACT}
      rows={data}
      rowKey={(domain) => domain.email_domain}
      columns={[
        { header: t("email-domain"), cell: (domain) => domain.email_domain },
        { header: t("total-completions"), cell: (domain) => domain.total_completions },
        { header: t("unique-users"), cell: (domain) => domain.unique_users },
        {
          header: t("registered-percentage"),
          cell: (domain) => `${domain.registered_completion_percentage?.toFixed(2) || "-"}%`,
        },
        { header: t("registered-completions"), cell: (domain) => domain.registered_completions },
        {
          header: t("unregistered-completions"),
          cell: (domain) => domain.not_registered_completions,
        },
        {
          header: t("users-with-registered"),
          cell: (domain) => domain.users_with_some_registered_completions,
        },
        {
          header: t("users-with-unregistered"),
          cell: (domain) => domain.users_with_some_unregistered_completions,
        },
        {
          header: t("registered-ects"),
          cell: (domain) => domain.registered_ects_credits.toFixed(1),
        },
        {
          header: t("unregistered-ects"),
          cell: (domain) => domain.not_registered_ects_credits.toFixed(1),
        },
        {
          header: t("actions"),
          cell: (domain) => (
            <Button
              variant="secondary"
              size="small"
              onClick={() => onDomainSelect(domain.email_domain)}
            >
              {t("view-courses")}
            </Button>
          ),
        },
      ]}
    />
  )

  return (
    <QueryResult query={query} treatEmptyAsData>
      {(data) => renderTable(data)}
    </QueryResult>
  )
}

export default withErrorBoundary(DomainCompletionStatsTable)
