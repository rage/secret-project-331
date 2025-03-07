import { css } from "@emotion/css"
import { UseQueryResult } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import FullWidthTable, { FullWidthTableRow } from "../../tables/FullWidthTable"

import { DomainCompletionStats } from "@/shared-module/common/bindings"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface DomainCompletionStatsTableProps {
  query: UseQueryResult<DomainCompletionStats[]>
  onDomainSelect: (domain: string) => void
}

const DomainCompletionStatsTable: React.FC<DomainCompletionStatsTableProps> = ({
  query,
  onDomainSelect,
}) => {
  const { t } = useTranslation()

  if (query.isError) {
    return <ErrorBanner variant="text" error={query.error} />
  }

  if (query.isLoading) {
    return (
      <div>
        <Spinner variant="medium" />
      </div>
    )
  }

  return (
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
        {query.data?.map((domain) => (
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
              <button
                onClick={() => onDomainSelect(domain.email_domain)}
                className={css`
                  padding: 0.25rem 0.5rem;
                  background-color: #f0f0f0;
                  border: 1px solid #ccc;
                  border-radius: 4px;
                  cursor: pointer;
                  &:hover {
                    background-color: #e0e0e0;
                  }
                `}
              >
                {t("view-courses")}
              </button>
            </td>
          </FullWidthTableRow>
        ))}
      </tbody>
    </FullWidthTable>
  )
}

export default withErrorBoundary(DomainCompletionStatsTable)
