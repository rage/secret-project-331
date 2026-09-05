"use client"

import { useEffect, useMemo } from "react"
import type {
  Control,
  DefaultValues,
  FieldValues,
  Path,
  UseFormHandleSubmit,
  UseFormReset,
  UseFormWatch,
} from "react-hook-form"
import { useForm } from "react-hook-form"

import usePaginationInfo, {
  type PaginationInfo,
} from "@/shared-module/common/hooks/usePaginationInfo"

import type { QueryParamFilters } from "./useQueryParamFilters"
import { useQueryParamFilters } from "./useQueryParamFilters"

export type FilterFieldValue = string | boolean

export interface FilterFieldDescriptor<Fields extends FieldValues> {
  /** The query string parameter this field reads from and writes to. */
  param: string
  field: Path<Fields>
  /** URL value -> form value; also seeds the form and resyncs it on Back or a pasted link. */
  fromParam: (raw: string | undefined) => FilterFieldValue
  /** Form value -> URL value; undefined clears the param. */
  toParam: (value: FilterFieldValue) => string | undefined
}

/** A `<Select>`-shaped filter: an empty string means "no filter" and clears the param. */
export function selectFilterField<Fields extends FieldValues>(
  param: string,
  field: Path<Fields>,
): FilterFieldDescriptor<Fields> {
  return {
    param,
    field,
    fromParam: (raw) => raw ?? "",
    toParam: (value) => (value === "" ? undefined : (value as string)),
  }
}

export interface UseFilteredAdminQueryResult<Fields extends FieldValues, Query> {
  control: Control<Fields>
  watch: UseFormWatch<Fields>
  handleSubmit: UseFormHandleSubmit<Fields>
  reset: UseFormReset<Fields>
  param: QueryParamFilters["param"]
  params: QueryParamFilters["params"]
  applyParams: QueryParamFilters["applyParams"]
  paginationInfo: PaginationInfo
  query: Query
}

/**
 * The scaffolding every admin filter tab shares: URL-backed filters, a `useForm` mirroring them, and
 * a query rebuilt from the URL. `fields` lists the ones that apply themselves on change (selects,
 * checkboxes, dates) and stay resynced from the URL on Back or a pasted link. A free-text field that
 * only applies on submit isn't one of these — it keeps being wired by the caller through the returned
 * `control`/`handleSubmit`/`applyParams`, as before; `manualDefaults` just seeds its initial value.
 */
export function useFilteredAdminQuery<Fields extends FieldValues, Query>(
  fields: FilterFieldDescriptor<Fields>[],
  buildQuery: (filters: QueryParamFilters, paginationInfo: PaginationInfo) => Query,
  options: {
    manualDefaults?: (filters: QueryParamFilters) => Partial<Fields>
    rowsPerPage?: number
  } = {},
): UseFilteredAdminQueryResult<Fields, Query> {
  const filters = useQueryParamFilters()
  const { param, params, applyParams } = filters
  const paginationInfo = usePaginationInfo(options.rowsPerPage)

  const defaultValues = useMemo(() => {
    const values: Record<string, FilterFieldValue> = {}
    for (const field of fields) {
      values[field.field] = field.fromParam(param(field.param))
    }
    return { ...values, ...options.manualDefaults?.(filters) } as DefaultValues<Fields>
    // Seeded once at mount; the effects below take over from here.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { control, watch, handleSubmit, reset, setValue } = useForm<Fields>({ defaultValues })
  const setFieldValue = setValue as unknown as (name: string, value: FilterFieldValue) => void
  const watchField = watch as unknown as (name: string) => FilterFieldValue

  const fieldStates = fields.map((field) => ({
    field,
    paramValue: param(field.param),
    watchedValue: watchField(field.field),
  }))

  // The params are the source of truth for what is filtered, so the fields follow the URL: Back, or
  // a shared link, has to move them. Deps length is stable across renders (one per caller-supplied
  // field), just not a literal array, which is what the lint rule can't verify.
  useEffect(
    () => {
      fieldStates.forEach(({ field, paramValue }) =>
        setFieldValue(field.field, field.fromParam(paramValue)),
      )
    },
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    fieldStates.map((fieldState) => fieldState.paramValue),
  )

  // And a changed field pushes back into the URL. Comparing against the URL-derived value, rather
  // than reacting unconditionally, is what stops this from bouncing right back against the sync
  // effect above: once the two agree, this has nothing left to apply.
  useEffect(
    () => {
      const changes: Record<string, string | undefined> = {}
      fieldStates.forEach(({ field, paramValue, watchedValue }) => {
        const urlValue = field.toParam(field.fromParam(paramValue))
        const formValue = field.toParam(watchedValue)
        if (formValue !== urlValue) {
          changes[field.param] = formValue
        }
      })
      if (Object.keys(changes).length > 0) {
        applyParams(changes)
      }
    },
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    fieldStates.map((fieldState) => fieldState.watchedValue),
  )

  const query = useMemo(
    () => buildQuery(filters, paginationInfo),
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [filters, paginationInfo.page, paginationInfo.limit],
  )

  return { control, watch, handleSubmit, reset, param, params, applyParams, paginationInfo, query }
}
