"use client"

import { useSearchParams } from "next/navigation"

const LANGUAGE_QUERY_KEY = "lang"

/**
 * Reads the desired UI language from the `?lang=` query parameter that the parent application sets
 * when embedding the exercise. Returns null when no language is specified.
 */
export default function useLanguage(): string | null {
  const searchParams = useSearchParams()
  return searchParams?.get(LANGUAGE_QUERY_KEY) ?? null
}
