import { useCallback, useMemo } from "react"
import { useForm } from "react-hook-form"

interface FilterFields {
  filter: string
}

const NO_FILTER: FilterFields = { filter: "" }

/**
 * A client-side text filter over listed people, for a `TextField` named `filter` on `control`.
 * `toSearchText` must be stable, e.g. declared at module level.
 */
export const useFilteredPeople = <Person>(
  people: readonly Person[],
  toSearchText: (person: Person) => string,
) => {
  const { control, watch, reset } = useForm<FilterFields>({ defaultValues: NO_FILTER })
  const filter = watch("filter")
  const shown = useMemo(() => {
    const needle = filter.trim().toLocaleLowerCase()
    return people.filter((person) => toSearchText(person).toLocaleLowerCase().includes(needle))
  }, [people, filter, toSearchText])
  const resetFilter = useCallback(() => reset(NO_FILTER), [reset])
  return { control, shown, reset: resetFilter }
}
