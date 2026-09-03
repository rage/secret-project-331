"use client"

import React, { useMemo } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import countries from "@/shared-module/common/locales/en/countries.json"
import { Select } from "@/shared-module/components"

import CompletionsByCountry from "../visualizations/country/CompletionsByCountry"
import StudentsByCountry from "../visualizations/country/StudentsByCountry"
import StudentsByCountryTotals from "../visualizations/country/StudentsByCountryTotals"

interface CountryStatsTabProps {
  courseId: string
}

const CountryStatsTab: React.FC<CountryStatsTabProps> = ({ courseId }) => {
  const { t } = useTranslation()
  const { t: tCountries } = useTranslation("countries")

  const { control, watch } = useForm<{ country: string }>({ defaultValues: { country: "" } })
  const selectedCountry = watch("country")

  const countriesOptions = useMemo(
    () =>
      Object.entries(countries).map(([code]) => ({
        value: code,
        label: tCountries(code as keyof typeof countries),
      })),
    [tCountries],
  )

  return (
    <>
      <Select
        name="country"
        control={control}
        label={t("label-select-country")}
        options={countriesOptions}
        searchEnabled
      />
      <StudentsByCountry courseId={courseId} selectedCountry={selectedCountry} />
      <CompletionsByCountry courseId={courseId} selectedCountry={selectedCountry} />
      <StudentsByCountryTotals courseId={courseId} />
    </>
  )
}

export default CountryStatsTab
