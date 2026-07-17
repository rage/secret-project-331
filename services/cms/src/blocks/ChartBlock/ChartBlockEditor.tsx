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
import React, { useEffect, useState } from "react"

import Button from "@/shared-module/common/components/Button"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import type { BlockEditProps } from "@/utils/Gutenberg/types"
import { useTranslation } from "@/utils/useCmsTranslation"

import type { ChartBlockAttributes } from "."
import BlockWrapper from "../BlockWrapper"
import ChartBlockEditModal from "./ChartBlockEditModal"
import ChartPreview, { chartCaptionStyle } from "./ChartPreview"

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

  // Local text state so the field can be cleared/edited freely; only valid values commit, reset on blur.
  const [heightInput, setHeightInput] = useState(String(height))
  useEffect(() => {
    setHeightInput(String(height))
  }, [height])

  const openModal = () => setIsModalOpen(true)

  const setHeight = (value: number) => {
    setAttributes({ height: Math.max(MIN_CHART_HEIGHT, Math.round(value)) })
  }

  const handleHeightInputChange = (value: string) => {
    setHeightInput(value)
    const parsed = Math.trunc(Number(value))
    if (!Number.isNaN(parsed) && parsed >= MIN_CHART_HEIGHT) {
      setHeight(parsed)
    }
  }

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
                type="number"
                label={t("chart-height-px")}
                value={heightInput}
                onChangeByValue={handleHeightInputChange}
                onBlur={() => setHeightInput(String(height))}
              />
              <Button variant="secondary" size="medium" onClick={openModal}>
                {t("edit-chart")}
              </Button>
            </div>
          </InspectorControls>
          <ResizableBox
            size={{ width: "100%", height }}
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
              setHeight(height + delta.height)
            }}
          >
            <ChartPreview spec={spec} height={height} caption={caption} />
          </ResizableBox>
          {caption?.trim() && <div className={chartCaptionStyle}>{caption}</div>}
        </>
      )}
      {modal}
    </BlockWrapper>
  )
}

export default ChartBlockEditor
