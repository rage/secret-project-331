import { css } from "@emotion/css"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

interface YearFilterProps {
  selectedYear: number | undefined
  onYearChange: (year: number | undefined) => void
}

const YearFilter: React.FC<YearFilterProps> = ({ selectedYear, onYearChange }) => {
  const { t } = useTranslation()

  const currentYear = useMemo(() => new Date().getFullYear(), [])
  const years = useMemo(
    () => Array.from({ length: currentYear - 2021 }, (_, i) => currentYear - i),
    [currentYear],
  )

  return (
    <div
      className={css`
        display: flex;
        align-items: center;
      `}
    >
      <label
        htmlFor="year-filter"
        className={css`
          margin-right: 0.5rem;
        `}
      >
        {t("filter-by-year")}
      </label>
      <select
        id="year-filter"
        value={selectedYear || ""}
        onChange={(e) => onYearChange(e.target.value ? Number(e.target.value) : undefined)}
        className={css`
          padding: 0.5rem;
          border-radius: 4px;
        `}
      >
        <option value="">{t("all-years")}</option>
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </div>
  )
}

export default YearFilter
