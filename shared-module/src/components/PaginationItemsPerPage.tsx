import { css } from "@emotion/css"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { PaginationInfo } from "../hooks/usePaginationInfo"

import SelectField from "./InputFields/SelectField"

interface PaginationItemsPerPageProps {
  paginationInfo: PaginationInfo
}

const PaginationItemsPerPage: React.FC<PaginationItemsPerPageProps> = ({ paginationInfo }) => {
  const { t } = useTranslation()
  const options = useMemo(() => {
    const options = [
      { value: "100", label: "100" },
      { value: "1000", label: "1000" },
      { value: "10000", label: "10000" },
    ]
    const currentLimit = paginationInfo.limit.toString()
    if (options.find((o) => o.value === currentLimit) === undefined) {
      // Someone edited a custom limit by changing the url. Let's support this use case by including this new option in the dropdown.
      options.push({ value: currentLimit, label: currentLimit })
      options.sort((o1, o2) => Number(o1.value) - Number(o2.value))
    }
    return options
  }, [paginationInfo.limit])
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
        onChange={(o) => {
          paginationInfo.setLimit(Number(o))
        }}
        options={options}
      ></SelectField>
    </div>
  )
}
export default PaginationItemsPerPage
