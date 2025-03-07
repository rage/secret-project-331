import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import CourseCompletionStatsTable from "../components/page-specific/domain-stats/CourseCompletionStatsTable"
import DomainCompletionStatsTable from "../components/page-specific/domain-stats/DomainCompletionStatsTable"
import YearFilter from "../components/page-specific/domain-stats/YearFilter"
import {
  getCompletionStatsByEmailDomain,
  getCourseCompletionStatsForEmailDomain,
} from "../services/backend/global-stats"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"

const DomainStatsPage = () => {
  const { t } = useTranslation()
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined)
  const [selectedDomain, setSelectedDomain] = useState<string | undefined>(undefined)

  // Query for all domains
  const domainStatsQuery = useQuery({
    queryKey: ["domainCompletionStats", selectedYear],
    queryFn: () => getCompletionStatsByEmailDomain(selectedYear),
  })

  // Query for courses within selected domain
  const courseStatsQuery = useQuery({
    queryKey: ["courseCompletionStats", selectedDomain, selectedYear],
    queryFn: () =>
      selectedDomain
        ? getCourseCompletionStatsForEmailDomain(selectedDomain, selectedYear)
        : Promise.resolve([]),
    enabled: !!selectedDomain, // Only run query when domain is selected
  })

  const handleDomainSelect = (domain: string) => {
    setSelectedDomain(domain)
  }

  const handleBackToAllDomains = () => {
    setSelectedDomain(undefined)
  }

  return (
    <div
      className={css`
        h2 {
          margin-top: 2rem;
        }
      `}
    >
      <h1>{t("domain-completion-statistics")}</h1>

      <div
        className={css`
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        `}
      >
        <div>
          {selectedDomain && (
            <button
              onClick={handleBackToAllDomains}
              className={css`
                margin-right: 1rem;
              `}
              // eslint-disable-next-line i18next/no-literal-string
            >
              ← {t("back-to-all-domains")}
            </button>
          )}
          {selectedDomain && <h2>{selectedDomain}</h2>}
        </div>
        <YearFilter selectedYear={selectedYear} onYearChange={setSelectedYear} />
      </div>

      {!selectedDomain ? (
        <DomainCompletionStatsTable query={domainStatsQuery} onDomainSelect={handleDomainSelect} />
      ) : (
        <CourseCompletionStatsTable query={courseStatsQuery} domain={selectedDomain} />
      )}
    </div>
  )
}

export default withSignedIn(DomainStatsPage)
