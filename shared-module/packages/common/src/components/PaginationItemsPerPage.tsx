"use client"

import { css } from "@emotion/css"
import { useEffect, useMemo, useRef } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type { SelectOption } from "@/shared-module/components/components/Select"
import { Select } from "@/shared-module/components/components/Select"

import type { PaginationInfo } from "../hooks/usePaginationInfo"

const DEFAULT_ITEMS_PER_PAGE_OPTIONS = [100, 1000, 10000]

interface PaginationItemsPerPageProps {
  paginationInfo: PaginationInfo
  itemsPerPageOptions?: number[]
}

interface ItemsPerPageFormValues {
  limit: string
}

const LIMIT_FIELD_NAME = "limit" as const

/**
 * Adapts `PaginationInfo`'s URL-synced limit (not form state) to `components`' RHF-only
 * `Select` via a local form kept in sync with it in both directions.
 */
const PaginationItemsPerPage: React.FC<PaginationItemsPerPageProps> = ({
  paginationInfo,
  itemsPerPageOptions,
}) => {
  const { t } = useTranslation()
  const { control, getValues, setValue, subscribe } = useForm<ItemsPerPageFormValues>({
    defaultValues: { limit: paginationInfo.limit.toString() },
  })

  // paginationInfo is a new object every render. Reading it through a ref keeps the subscribe
  // effect below mounted for the component's lifetime instead of tearing down and rebuilding
  // the subscription every render, which could leave it briefly absent for setValue's
  // synchronous callback in the effect above.
  const paginationInfoRef = useRef(paginationInfo)
  paginationInfoRef.current = paginationInfo

  // setValue only reaches the subscriber below when it actually changes the value. This flag
  // marks that change as external so the subscriber does not echo it back into
  // paginationInfo.setLimit, which would reset the page to 1 on every external limit change.
  const isSyncingFromExternalRef = useRef(false)

  useEffect(() => {
    const nextLimit = paginationInfo.limit.toString()
    if (getValues(LIMIT_FIELD_NAME) === nextLimit) {
      return
    }
    isSyncingFromExternalRef.current = true
    setValue(LIMIT_FIELD_NAME, nextLimit)
  }, [paginationInfo.limit, getValues, setValue])

  useEffect(() => {
    return subscribe({
      name: LIMIT_FIELD_NAME,
      formState: { values: true },
      callback: ({ values }) => {
        if (isSyncingFromExternalRef.current) {
          isSyncingFromExternalRef.current = false
          return
        }
        paginationInfoRef.current.setLimit(Number(values.limit))
      },
    })
  }, [subscribe])

  const options: SelectOption[] = useMemo(() => {
    const base = itemsPerPageOptions ?? DEFAULT_ITEMS_PER_PAGE_OPTIONS
    const mappedOptions = base.map((n) => ({ value: n.toString(), label: n.toString() }))
    const currentLimit = paginationInfo.limit.toString()
    if (!mappedOptions.some((o) => o.value === currentLimit)) {
      // A limit set via the URL that isn't one of the standard options; show it too.
      mappedOptions.push({ value: currentLimit, label: currentLimit })
      mappedOptions.sort((o1, o2) => Number(o1.value) - Number(o2.value))
    }
    return mappedOptions
  }, [paginationInfo.limit, itemsPerPageOptions])

  return (
    <div
      className={css`
        max-width: 150px;
        width: 100%;
        margin: 0 auto;
      `}
    >
      <Select
        control={control}
        name={LIMIT_FIELD_NAME}
        label={t("label-items-per-page")}
        id="set-pagination-limit"
        options={options}
      />
    </div>
  )
}
export default PaginationItemsPerPage
