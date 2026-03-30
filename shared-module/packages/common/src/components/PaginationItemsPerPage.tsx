"use client"

import { css } from "@emotion/css"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { PaginationInfo } from "../hooks/usePaginationInfo"

import SelectField from "./InputFields/SelectField"

const DEFAULT_ITEMS_PER_PAGE_OPTIONS = [100, 1000, 10000]

interface PaginationItemsPerPageProps {
  paginationInfo: PaginationInfo
  itemsPerPageOptions?: number[]
}

const PaginationItemsPerPage: React.FC<PaginationItemsPerPageProps> = ({
  paginationInfo,
  itemsPerPageOptions,
}) => {
  const { t } = useTranslation()
  const options = useMemo(() => {
    const base = itemsPerPageOptions ?? DEFAULT_ITEMS_PER_PAGE_OPTIONS
    const options = base.map((n) => ({ value: n.toString(), label: n.toString() }))
    const currentLimit = paginationInfo.limit.toString()
    if (options.find((o) => o.value === currentLimit) === undefined) {
      // Someone edited a custom limit by changing the url. Let's support this use case by including this new option in the dropdown.
      options.push({ value: currentLimit, label: currentLimit })
      options.sort((o1, o2) => Number(o1.value) - Number(o2.value))
    }
    return options
  }, [paginationInfo.limit, itemsPerPageOptions])
  return (
    <div
      className={css`
        max-width: 150px;
        width: 100%;
        margin: 0 auto;
      `}
    >
      <SelectField
        label={t("label-items-per-page")}
        id={"set-pagination-limit"}
        value={paginationInfo.limit.toString()}
        onChangeByValue={(o) => {
          paginationInfo.setLimit(Number(o))
        }}
        options={options}
      ></SelectField>
    </div>
  )
}
export default PaginationItemsPerPage
