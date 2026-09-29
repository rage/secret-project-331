"use client"

import { css } from "@emotion/css"
import { type TooltipTriggerState, useTooltipTriggerState } from "@react-stately/tooltip"
import { type RefObject, useRef } from "react"
import {
  mergeProps,
  Overlay,
  type TooltipTriggerAria,
  useOverlayPosition,
  useTooltip,
  useTooltipTrigger,
} from "react-aria"

import { secondaryFont } from "@/shared-module/common/styles"

import { progressColors, TOOLTIP_PLACEMENT } from "./progressTheme"

const TOOLTIP_OFFSET_PX = 8

/**
 * Makes a chart element its tooltip's trigger. Spread `triggerProps` on the element, which also
 * becomes its section's single tab stop, and render `<ChartTooltip {...tooltip} />` beside it.
 */
export function useChartTooltip(triggerRef: RefObject<HTMLElement | null>) {
  const state = useTooltipTriggerState({ delay: 300, closeDelay: 500 })
  const { triggerProps, tooltipProps } = useTooltipTrigger({}, state, triggerRef)
  return {
    triggerProps: mergeProps(triggerProps, { tabIndex: 0 }),
    tooltip: { state, triggerRef, tooltipProps },
  }
}

interface ChartTooltipProps {
  state: TooltipTriggerState
  triggerRef: RefObject<HTMLElement | null>
  /** Carries the id the trigger's `aria-describedby` points at. */
  tooltipProps: TooltipTriggerAria["tooltipProps"]
  lines: string[]
}

/**
 * The chart's facts on hover and keyboard focus, one per line, placed above the chart.
 */
export function ChartTooltip({ state, triggerRef, tooltipProps, lines }: ChartTooltipProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const { tooltipProps: ariaTooltipProps } = useTooltip({}, state)
  const { overlayProps } = useOverlayPosition({
    targetRef: triggerRef,
    overlayRef,
    placement: TOOLTIP_PLACEMENT,
    offset: TOOLTIP_OFFSET_PX,
    shouldFlip: false,
    isOpen: state.isOpen,
  })

  if (!state.isOpen) {
    return null
  }
  return (
    <Overlay>
      <div
        {...mergeProps(tooltipProps, ariaTooltipProps, overlayProps)}
        ref={overlayRef}
        className={tooltipCss}
      >
        {lines.map((line) => (
          <div key={line}>
            <bdi>{line}</bdi>
          </div>
        ))}
      </div>
    </Overlay>
  )
}

const tooltipCss = css`
  z-index: 10;
  max-width: calc(100vw - 2rem);
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  background: ${progressColors.tooltip};
  color: ${progressColors.keyStrip};
  font: 500 0.875rem/1.4 ${secondaryFont};
  text-align: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);

  @media (forced-colors: active) {
    background: Canvas;
    color: CanvasText;
    border: 1px solid CanvasText;
  }
`
