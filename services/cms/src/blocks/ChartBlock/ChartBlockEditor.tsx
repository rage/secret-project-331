"use client"

import { css } from "@emotion/css"
import {
  BlockControls,
  store as blockEditorStore,
  BlockIcon,
  InspectorControls,
} from "@wordpress/block-editor"
import { Placeholder, ResizableBox, ToolbarButton, ToolbarGroup } from "@wordpress/components"
import { useDispatch } from "@wordpress/data"
import { image as icon } from "@wordpress/icons"
import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"

import { Button } from "@/shared-module/components/components/Button"
import { TextField } from "@/shared-module/components/components/TextField"
import type { BlockEditProps } from "@/utils/Gutenberg/types"
import { useTranslation } from "@/utils/useCmsTranslation"

import type { ChartBlockAttributes } from "."
import BlockWrapper from "../BlockWrapper"
import ChartBlockEditModal from "./ChartBlockEditModal"
import ChartPreview, { chartCaptionStyle } from "./ChartPreview"
import { DEFAULT_CHART_HEIGHT, isMultiViewSpec, resolveChartLayout } from "./chartSpec"

const MIN_CHART_HEIGHT = 120

// Chart renders by default; the toolbar/inspector "Edit" button opens the modal. Only height is
// resizable (bottom edge + inspector field); width stays responsive.
const ChartBlockEditor: React.FC<React.PropsWithChildren<BlockEditProps<ChartBlockAttributes>>> = ({
  clientId,
  attributes,
  setAttributes,
  isSelected,
}) => {
  const { t } = useTranslation()
  const { toggleSelection } = useDispatch(blockEditorStore)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { spec, caption, height } = attributes

  // The chart's natural (unscaled) rendered height, reported by ChartPreview. For multi-view
  // charts `height` can't size the spec, so the preview is scaled with CSS instead; this drives
  // the box height and lets the drag handle / inspector field resize a multi-view chart.
  const [naturalHeight, setNaturalHeight] = useState<number | null>(null)
  const handleNaturalHeightChange = useCallback((px: number) => setNaturalHeight(px), [])

  const isMultiView = useMemo(() => {
    try {
      return isMultiViewSpec(JSON.parse(spec))
    } catch {
      return false
    }
  }, [spec])

  // The displayed box height: the set height for single-view charts, or (for multi-view) the
  // scaled-to-fit height, defaulting to the chart's full natural size until it's resized.
  const { boxHeightPx } = resolveChartLayout({
    heightAttr: height,
    autoHeightSentinel: DEFAULT_CHART_HEIGHT,
    naturalHeightPx: naturalHeight,
    isMultiView,
  })

  // The new shared TextField is react-hook-form based. The field mirrors the displayed box height
  // (which may differ from the stored `height` while a multi-view chart is at its auto size), and
  // only a user edit — not this programmatic mirroring — commits a new height.
  const { control, watch, getValues, setValue } = useForm<{ height: string }>({
    defaultValues: { height: String(boxHeightPx) },
  })
  useEffect(() => {
    if (String(boxHeightPx) !== getValues("height")) {
      setValue("height", String(boxHeightPx))
    }
  }, [boxHeightPx, getValues, setValue])

  const openModal = () => setIsModalOpen(true)

  const setHeight = (value: number) => {
    setAttributes({ height: Math.max(MIN_CHART_HEIGHT, Math.round(value)) })
  }

  useEffect(() => {
    const subscription = watch((values, { name }) => {
      if (name !== "height") {
        return
      }
      const parsed = Math.trunc(Number(values.height))
      // Ignore the echo from mirroring boxHeightPx into the field; only commit real user edits.
      if (!Number.isNaN(parsed) && parsed >= MIN_CHART_HEIGHT && parsed !== boxHeightPx) {
        setHeight(parsed)
      }
    })
    return () => subscription.unsubscribe()
  })

  const modal = (
    <ChartBlockEditModal
      isOpen={isModalOpen}
      onClose={() => setIsModalOpen(false)}
      attributes={attributes}
      setAttributes={setAttributes}
    />
  )

  // The modal is rendered outside the branches at a stable child position: clearing the spec in
  // the modal's editor must not remount the modal (a remount would drop its state, including the
  // debounced data extraction).
  return (
    <BlockWrapper id={clientId}>
      {!spec?.trim() ? (
        <Placeholder
          icon={<BlockIcon icon={icon} />}
          label={t("edit-chart")}
          instructions={t("chart-block-empty-instructions")}
        >
          <Button variant="primary" size="medium" onClick={openModal}>
            {t("edit-chart")}
          </Button>
        </Placeholder>
      ) : (
        <>
          <BlockControls>
            <ToolbarGroup>
              <ToolbarButton onClick={openModal}>{t("edit-chart")}</ToolbarButton>
            </ToolbarGroup>
          </BlockControls>
          <InspectorControls key="settings">
            <div
              className={css`
                padding: 1rem;
                display: flex;
                flex-direction: column;
                gap: 1rem;
              `}
            >
              <TextField
                name="height"
                control={control}
                type="number"
                label={t("chart-height-px")}
                min={MIN_CHART_HEIGHT}
                rules={{
                  validate: (value) => {
                    const parsed = Math.trunc(Number(value))
                    return (
                      (!Number.isNaN(parsed) && parsed >= MIN_CHART_HEIGHT) ||
                      t("chart-height-min", { min: MIN_CHART_HEIGHT })
                    )
                  },
                }}
              />
              <Button variant="secondary" size="medium" onClick={openModal}>
                {t("edit-chart")}
              </Button>
            </div>
          </InspectorControls>
          <ResizableBox
            // Sized to the displayed chart so nothing overlaps the blocks below; dragging sets a
            // new height relative to what's actually shown (which scales a multi-view chart).
            size={{ width: "100%", height: boxHeightPx }}
            minHeight={MIN_CHART_HEIGHT}
            showHandle={isSelected}
            enable={{
              top: false,
              right: false,
              bottom: true,
              left: false,
              topRight: false,
              bottomRight: false,
              bottomLeft: false,
              topLeft: false,
            }}
            onResizeStart={() => toggleSelection(false)}
            onResizeStop={(_event, _direction, _elt, delta) => {
              toggleSelection(true)
              setHeight(boxHeightPx + delta.height)
            }}
          >
            <ChartPreview
              spec={spec}
              height={height}
              caption={caption}
              onNaturalHeightChange={handleNaturalHeightChange}
            />
          </ResizableBox>
          {caption?.trim() && <div className={chartCaptionStyle}>{caption}</div>}
        </>
      )}
      {modal}
    </BlockWrapper>
  )
}

export default ChartBlockEditor
