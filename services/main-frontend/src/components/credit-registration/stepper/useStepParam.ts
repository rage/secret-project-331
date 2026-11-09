"use client"

import { useSearchParams } from "next/navigation"
import { useCallback } from "react"

import { isStepperPage, type StepperPage } from "./stepperView"

const STEP_PARAM = "step"

/**
 * The stepper page in the address, so the browser's back button steps back through the pages.
 *
 * Written with `pushState`, not `router.push`: Next keys this route's client cache by the search
 * string the server rendered with, so a query-only router navigation snaps the address back.
 */
export const useStepParam = () => {
  const searchParams = useSearchParams()
  const value = searchParams?.get(STEP_PARAM) ?? null
  const requestedPage = isStepperPage(value) ? value : null

  const goTo = useCallback((page: StepperPage) => {
    const next = new URLSearchParams(window.location.search)
    next.set(STEP_PARAM, page)
    window.history.pushState(null, "", `${window.location.pathname}?${next.toString()}`)
  }, [])

  return { requestedPage, goTo }
}
