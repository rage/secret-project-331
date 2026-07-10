"use client"

import { css } from "@emotion/css"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import CourseCompletionStatsTable from "./CourseCompletionStatsTable"
import DomainCompletionStatsTable from "./DomainCompletionStatsTable"
import YearFilter from "./YearFilter"

import {
  useCompletionStatsByEmailDomainQuery,
  useCourseCompletionStatsForEmailDomainQuery,
} from "@/hooks/globalStats"
import Button from "@/shared-module/common/components/Button"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const SelectedDomainCourseStatsTable = ({
  selectedDomain,
  selectedYear,
}: {
  selectedDomain: string
  selectedYear: number | undefined
}) => {
  const courseStatsQuery = useCourseCompletionStatsForEmailDomainQuery(selectedDomain, selectedYear)

  return <CourseCompletionStatsTable query={courseStatsQuery} domain={selectedDomain} />
}

const DomainStatsPage = () => {
  const { t } = useTranslation()
  usePageTitle(t("domain-completion-statistics"))
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined)
  const [selectedDomain, setSelectedDomain] = useState<string | undefined>(undefined)

  const domainStatsQuery = useCompletionStatsByEmailDomainQuery(selectedYear)

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
            <Button
              variant="tertiary"
              size="small"
              onClick={handleBackToAllDomains}
              transform="none"
              className={css`
                margin-right: 1rem;
              `}
              // oxlint-disable-next-line i18next/no-literal-string
            >
              {/* oxlint-disable-next-line i18next/no-literal-string */}← {t("back-to-all-domains")}
            </Button>
          )}
          {selectedDomain && <h2>{selectedDomain}</h2>}
        </div>
        <YearFilter selectedYear={selectedYear} onYearChange={setSelectedYear} />
      </div>

      {!selectedDomain ? (
        <DomainCompletionStatsTable query={domainStatsQuery} onDomainSelect={handleDomainSelect} />
      ) : (
        <SelectedDomainCourseStatsTable
          selectedDomain={selectedDomain}
          selectedYear={selectedYear}
        />
      )}
    </div>
  )
}

export default withErrorBoundary(withSignedIn(DomainStatsPage))
