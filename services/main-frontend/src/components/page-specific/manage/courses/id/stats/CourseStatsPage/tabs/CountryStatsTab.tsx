import React from "react"
import { useTranslation } from "react-i18next"

import CompletionsByCountry from "../../visualizations/country/CompletionsByCountry"
import FirstExerciseSubmissionsByModule from "../../visualizations/country/FirstExerciseSubmissionsByModule"
import StudentsByCountry from "../../visualizations/country/StudentsByCountry"
import StudentsByCountryTotals from "../../visualizations/country/StudentsByCountryTotals"

import SearchableSelectField from "@/shared-module/common/components/InputFields/SearchableSelectField"
import countries from "@/shared-module/common/locales/en/countries.json"

interface CountryStatsTabProps {
  courseId: string
}

const CountryStatsTab: React.FC<CountryStatsTabProps> = ({ courseId }) => {
  const { t } = useTranslation()
  const { t: tCountries } = useTranslation("countries")

  const [selectedCountry, setSelectedCountry] = React.useState<string>("")

  const countriesOptions = React.useMemo(
    () =>
      Object.entries(countries).map(([code]) => ({
        value: code,
        label: tCountries(code as keyof typeof countries),
      })),
    [tCountries],
  )

  return (
    <>
      <SearchableSelectField
        label={t("label-select-country")}
        options={countriesOptions}
        value={selectedCountry}
        onChangeByValue={setSelectedCountry}
        placeholder={t("label-select-country")}
      />
      <StudentsByCountry courseId={courseId} selectedCountry={selectedCountry} />
      <CompletionsByCountry courseId={courseId} selectedCountry={selectedCountry} />
      <StudentsByCountryTotals courseId={courseId} />
      <FirstExerciseSubmissionsByModule courseId={courseId} />
    </>
  )
}

export default CountryStatsTab
