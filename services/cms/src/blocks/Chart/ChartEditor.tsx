"use client"

import { css } from "@emotion/css"
import { BlockControls, BlockIcon, InspectorControls } from "@wordpress/block-editor"
import { Placeholder, ResizableBox, ToolbarButton, ToolbarGroup } from "@wordpress/components"
import { useDispatch } from "@wordpress/data"
import { image as icon } from "@wordpress/icons"
import React from "react"

import { Button } from "@/shared-module/components/components/Button"
import { TextField } from "@/shared-module/components/components/TextField"
import type { BlockEditProps } from "@/utils/Gutenberg/types"
import { useTranslation } from "@/utils/useCmsTranslation"

import type { ChartAttributes } from "."
import BlockWrapper from "../BlockWrapper"
import ChartEditModal from "./ChartEditModal"
import ChartPreview, { chartCaptionStyle } from "./ChartPreview"
import { useChartEditModalState } from "./useChartEditModalState"
import { useChartHeightControl } from "./useChartHeightControl"

const MIN_CHART_HEIGHT = 120

const BLOCK_EDITOR_STORE = "core/block-editor"

// The canvas shows a placeholder until the block has a spec, then renders the chart. A freshly
// inserted block opens the editor modal automatically; the toolbar/inspector "Edit" button also
// opens it. Only height is resizable (bottom edge + inspector field); width stays responsive.
const ChartEditor: React.FC<React.PropsWithChildren<BlockEditProps<ChartAttributes>>> = ({
  clientId,
  attributes,
  setAttributes,
  isSelected,
}) => {
  const { t } = useTranslation()
  const { toggleSelection } = useDispatch(BLOCK_EDITOR_STORE)
  const { spec, caption, height, heightIsAuto } = attributes
  const { isModalOpen, openModal, closeModal } = useChartEditModalState({ clientId, spec })

  const { boxHeightPx, heightFieldControl, reportNaturalHeight, commitHeight } =
    useChartHeightControl({
      spec,
      heightPx: height,
      heightIsAuto,
      minHeightPx: MIN_CHART_HEIGHT,
      onHeightChange: (heightPx) => setAttributes({ height: heightPx, heightIsAuto: false }),
    })

  const modal = (
    <ChartEditModal
      isOpen={isModalOpen}
      onClose={closeModal}
      attributes={attributes}
      setAttributes={setAttributes}
    />
  )

  // The modal is rendered outside the branches at a stable child position: clearing the spec in
  // the modal's editor must not remount the modal (a remount would drop its state, including the
  // debounced data extraction).
  return (
    <BlockWrapper>
      {!spec?.trim() ? (
        <Placeholder
          icon={<BlockIcon icon={icon} />}
          label={t("edit-chart")}
          instructions={t("chart-block-empty-instructions")}
        >
          <Button variant="primary" size="medium" onPress={openModal}>
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
                control={heightFieldControl}
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
              <Button variant="secondary" size="medium" onPress={openModal}>
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
              commitHeight(boxHeightPx + delta.height)
            }}
          >
            <ChartPreview
              spec={spec}
              height={height}
              heightIsAuto={heightIsAuto}
              caption={caption}
              onNaturalHeightChange={reportNaturalHeight}
            />
          </ResizableBox>
          {caption?.trim() && <div className={chartCaptionStyle}>{caption}</div>}
        </>
      )}
      {modal}
    </BlockWrapper>
  )
}

export default ChartEditor
