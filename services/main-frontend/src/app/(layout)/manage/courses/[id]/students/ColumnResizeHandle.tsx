"use client"

import React, { useCallback, useEffect, useRef } from "react"
import { mergeProps, useMove } from "react-aria"

import { MIN_COLUMN_WIDTH } from "./columnWidths"
import { resizeHandleCss } from "./studentsTableStyles"

const KEYBOARD_STEP_PX = 16
const KEYBOARD_STEP_LARGE_PX = 64
const SLIDER_ROLE = "slider"
const HORIZONTAL = "horizontal"
export const RESIZE_HANDLE_TESTID = "column-resize-handle"

interface ColumnResizeHandleProps {
  columnId: string
  /** Read on demand: a keypress commits and re-reads within one batch, so a value prop goes stale. */
  getWidth: (columnId: string) => number
  minWidth: number
  /** Ceiling for this handle's target. A grouped header spans several columns, so it allows more. */
  maxWidth: number
  label: string
  /** The pinned clone sits inside aria-hidden, so its copy carries no role, name or tab stop. */
  presentational: boolean
  onResizeStart: () => void
  onResize: (columnId: string, width: number) => void
  onResizeEnd: () => void
  onReset: (columnId: string) => void
}

/**
 * Drag or arrow-key target that resizes one column, or -- on a grouped header -- the whole span at
 * once. Rendered in each header copy; only the real header's copy is exposed and focusable.
 */
export const ColumnResizeHandle: React.FC<ColumnResizeHandleProps> = ({
  columnId,
  getWidth,
  minWidth,
  maxWidth,
  label,
  presentational,
  onResizeStart,
  onResize,
  onResizeEnd,
  onReset,
}) => {
  const widthRef = useRef(0)
  const isDraggingRef = useRef(false)

  const { moveProps } = useMove({
    onMoveStart: () => {
      widthRef.current = getWidth(columnId)
      isDraggingRef.current = true
      onResizeStart()
    },
    onMove: ({ deltaX, pointerType, shiftKey }) => {
      const step =
        pointerType === "keyboard" ? (shiftKey ? KEYBOARD_STEP_LARGE_PX : KEYBOARD_STEP_PX) : 1
      widthRef.current = Math.min(maxWidth, Math.max(minWidth, widthRef.current + deltaX * step))
      onResize(columnId, Math.round(widthRef.current))
    },
    onMoveEnd: () => {
      isDraggingRef.current = false
      onResizeEnd()
    },
  })

  // useMove keeps its pointer listeners on the window and drops them in its own unmount cleanup, so
  // a handle that disappears mid-gesture would otherwise never report the drag as finished.
  useEffect(
    () => () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false
        onResizeEnd()
      }
    },
    [onResizeEnd],
  )

  // The drag's trailing click would otherwise reach the header cell and toggle sorting.
  const stopClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation()
  }, [])

  const handleDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation()
      onReset(columnId)
    },
    [columnId, onReset],
  )

  const interactionProps = mergeProps(moveProps, {
    onClick: stopClick,
    onDoubleClick: handleDoubleClick,
  })

  if (presentational) {
    return (
      <div {...interactionProps} className={resizeHandleCss} data-testid={RESIZE_HANDLE_TESTID} />
    )
  }

  return (
    <div
      {...interactionProps}
      role={SLIDER_ROLE}
      tabIndex={0}
      aria-label={label}
      aria-orientation={HORIZONTAL}
      aria-valuenow={Math.round(getWidth(columnId))}
      aria-valuemin={Math.max(minWidth, MIN_COLUMN_WIDTH)}
      aria-valuemax={maxWidth}
      className={resizeHandleCss}
      data-testid={RESIZE_HANDLE_TESTID}
    />
  )
}
