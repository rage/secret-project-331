import { useEffect, useLayoutEffect, useRef, useState } from "react"

import type { CourseDesignerStage } from "@/generated/api/types.generated"

interface UseStageTimelineMeasurementsOptions {
  activeStage: CourseDesignerStage | null
  selectedStage: CourseDesignerStage | null
  stagesDependency: unknown
  currentStageLabel?: string | null
}

/** Positions today marker, current-stage callout, and scrolls selected tab into view. */
export function useStageTimelineMeasurements({
  activeStage,
  selectedStage,
  stagesDependency,
  currentStageLabel,
}: UseStageTimelineMeasurementsOptions) {
  const [todayPositionPx, setTodayPositionPx] = useState<number | null>(null)
  const [currentStagePosition, setCurrentStagePosition] = useState<{
    left: number
    minWidth: number
  } | null>(null)
  const [calloutWidth, setCalloutWidth] = useState(0)

  const listRef = useRef<HTMLDivElement | null>(null)
  const shellRef = useRef<HTMLDivElement | null>(null)
  const currentStageCalloutRef = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    if (!activeStage) {
      setCalloutWidth(0)
      return
    }
    const calloutElement = currentStageCalloutRef.current
    if (!calloutElement) {
      return
    }
    const updateCalloutWidth = () => {
      const width = calloutElement.offsetWidth
      if (width > 0) {
        setCalloutWidth(width)
      }
    }
    updateCalloutWidth()
    if (typeof ResizeObserver === "undefined") {
      return
    }
    const resizeObserver = new ResizeObserver(updateCalloutWidth)
    resizeObserver.observe(calloutElement)
    return () => {
      resizeObserver.disconnect()
    }
  }, [activeStage, currentStageLabel])

  useEffect(() => {
    const updateTodayPosition = () => {
      const listElement = listRef.current
      if (!listElement) {
        setTodayPositionPx(null)
        return
      }
      const todayMonthElement = listElement.querySelector<HTMLElement>('[data-today-month="true"]')
      if (!todayMonthElement) {
        setTodayPositionPx(null)
        return
      }
      const listRect = listElement.getBoundingClientRect()
      const monthRect = todayMonthElement.getBoundingClientRect()
      const centerX = monthRect.left + monthRect.width / 2 - listRect.left
      setTodayPositionPx(centerX)
    }

    updateTodayPosition()
    if (typeof window === "undefined") {
      return
    }
    window.addEventListener("resize", updateTodayPosition)
    return () => {
      window.removeEventListener("resize", updateTodayPosition)
    }
  }, [stagesDependency])

  useEffect(() => {
    const updateCurrentStagePosition = () => {
      if (!activeStage) {
        setCurrentStagePosition(null)
        return
      }

      const shellElement = shellRef.current
      const listElement = listRef.current
      if (!shellElement || !listElement) {
        setCurrentStagePosition(null)
        return
      }

      const activeTabElement = listElement.querySelector<HTMLElement>(
        `[data-stage-key="${activeStage}"]`,
      )
      if (!activeTabElement) {
        setCurrentStagePosition(null)
        return
      }

      const shellRect = shellElement.getBoundingClientRect()
      const tabRect = activeTabElement.getBoundingClientRect()
      const centerX = tabRect.left + tabRect.width / 2 - shellRect.left + shellElement.scrollLeft
      const effectiveCalloutWidth = calloutWidth || Math.min(tabRect.width + 32, 360)
      const edgePadding = 4
      const viewportLeft = shellElement.scrollLeft
      const viewportRight = viewportLeft + shellElement.clientWidth
      const minLeft = viewportLeft + edgePadding
      const maxLeft = viewportRight - effectiveCalloutWidth - edgePadding
      const rawLeft = centerX - effectiveCalloutWidth / 2
      const clampedLeft =
        maxLeft < minLeft ? minLeft : Math.max(minLeft, Math.min(rawLeft, maxLeft))
      setCurrentStagePosition({
        left: clampedLeft,
        minWidth: Math.min(tabRect.width + 32, 360),
      })
    }

    updateCurrentStagePosition()
    if (typeof window === "undefined") {
      return
    }
    window.addEventListener("resize", updateCurrentStagePosition)

    const shellElement = shellRef.current
    shellElement?.addEventListener("scroll", updateCurrentStagePosition)

    return () => {
      window.removeEventListener("resize", updateCurrentStagePosition)
      shellElement?.removeEventListener("scroll", updateCurrentStagePosition)
    }
  }, [activeStage, calloutWidth, stagesDependency])

  useEffect(() => {
    if (!selectedStage || !listRef.current) {
      return
    }
    const tabElement = listRef.current.querySelector<HTMLElement>(
      `[data-stage-key="${selectedStage}"]`,
    )
    if (tabElement) {
      // eslint-disable-next-line i18next/no-literal-string
      tabElement.scrollIntoView({ block: "nearest", inline: "center" })
    }
  }, [selectedStage])

  return {
    todayPositionPx,
    currentStagePosition,
    listRef,
    shellRef,
    currentStageCalloutRef,
  }
}
