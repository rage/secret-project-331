"use client"

import type { UseQueryResult } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import FullWidthTable, { FullWidthTableRow } from "@/components/tables/FullWidthTable"
import type { DomainCompletionStats } from "@/generated/api/types.generated"
import Button from "@/shared-module/common/components/Button"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { QueryResult } from "@/shared-module/components"

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
    <FullWidthTable>
      <thead>
        <FullWidthTableRow>
          <th>{t("email-domain")}</th>
          <th>{t("total-completions")}</th>
          <th>{t("unique-users")}</th>
          <th>{t("registered-percentage")}</th>
          <th>{t("registered-completions")}</th>
          <th>{t("unregistered-completions")}</th>
          <th>{t("users-with-registered")}</th>
          <th>{t("users-with-unregistered")}</th>
          <th>{t("registered-ects")}</th>
          <th>{t("unregistered-ects")}</th>
          <th>{t("actions")}</th>
        </FullWidthTableRow>
      </thead>
      <tbody>
        {data.map((domain) => (
          <FullWidthTableRow key={domain.email_domain}>
            <td>{domain.email_domain}</td>
            <td>{domain.total_completions}</td>
            <td>{domain.unique_users}</td>
            <td>{domain.registered_completion_percentage?.toFixed(2) || "-"}%</td>
            <td>{domain.registered_completions}</td>
            <td>{domain.not_registered_completions}</td>
            <td>{domain.users_with_some_registered_completions}</td>
            <td>{domain.users_with_some_unregistered_completions}</td>
            <td>{domain.registered_ects_credits.toFixed(1)}</td>
            <td>{domain.not_registered_ects_credits.toFixed(1)}</td>
            <td>
              <Button
                variant="secondary"
                size="small"
                onClick={() => onDomainSelect(domain.email_domain)}
                transform="none"
              >
                {t("view-courses")}
              </Button>
            </td>
          </FullWidthTableRow>
        ))}
      </tbody>
    </FullWidthTable>
  )

  return (
    <QueryResult query={query} treatEmptyAsData>
      {(data) => renderTable(data)}
    </QueryResult>
  )
}

export default withErrorBoundary(DomainCompletionStatsTable)
