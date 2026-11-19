"use client"

import { useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { Select } from "@/shared-module/components"

interface YearFilterProps {
  selectedYear: number | undefined
  onYearChange: (year: number | undefined) => void
}

const ALL_YEARS = "all"

const YearFilter: React.FC<YearFilterProps> = ({ selectedYear, onYearChange }) => {
  const { t } = useTranslation()

  const currentYear = useMemo(() => new Date().getFullYear(), [])
  const years = useMemo(
    () => Array.from({ length: currentYear - 2021 }, (_, i) => currentYear - i),
    [currentYear],
  )
  const { control, watch, setValue } = useForm<{ year: string }>({
    defaultValues: { year: selectedYear ? String(selectedYear) : ALL_YEARS },
  })
  const year = watch("year")

  useEffect(() => {
    const nextYear = year === ALL_YEARS ? undefined : Number(year)
    if (nextYear !== selectedYear) {
      onYearChange(nextYear)
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [year])

  useEffect(() => {
    setValue("year", selectedYear ? String(selectedYear) : ALL_YEARS)
  }, [selectedYear, setValue])

  return (
    <Select
      name="year"
      control={control}
      label={t("filter-by-year")}
      options={[
        { value: ALL_YEARS, label: t("all-years") },
        ...years.map((y) => ({ value: String(y), label: String(y) })),
      ]}
    />
  )
}

export default YearFilter
