"use client"

import { css } from "@emotion/css"
import type { Monaco } from "@monaco-editor/react"
import React from "react"

import { useVerticalResizeHandle } from "@/hooks/useVerticalResizeHandle"
import MonacoEditor from "@/shared-module/common/components/monaco/MonacoEditor"
import { baseTheme, fontWeights, primaryFont } from "@/shared-module/common/styles"
import { Button } from "@/shared-module/components/components/Button"
import { useTranslation } from "@/utils/useCmsTranslation"

// Config/identifier strings kept out of i18next/no-literal-string.
const MONACO_LANGUAGE = "json"
const ON = "on"

const EDITOR_ID = "chart-block-vega-json-editor"
const RESIZE_HINT_ID = "chart-block-vega-json-resize-hint"
const DEFAULT_HEIGHT = 360
const MIN_HEIGHT = 160
const MAX_HEIGHT = 900
// Height change per arrow-key press while the resize handle has focus.
const RESIZE_STEP = 40

// Let Monaco fetch the schema named in the spec's $schema field (the Vega-Lite schema),
// enabling validation and autocompletion in the JSON editor.
const enableJsonSchemaSupport = (monaco: Monaco) => {
  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    enableSchemaRequest: true,
  })
}

const headerStyles = css`
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
`

const headerLabelStyles = css`
  margin: 0;
  font-family: ${primaryFont};
  font-size: 0.8125rem;
  color: ${baseTheme.colors.gray[700]};
  font-weight: ${fontWeights.medium};
`

const headerActionsStyles = css`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`

interface VegaJsonEditorProps {
  spec: string
  /** A spec being typed is often mid-edit invalid; the box and a badge say so without blocking. */
  isValidJson: boolean
  /** Whether the editor itself is expanded; the header and its toggle always show. */
  isShown: boolean
  onToggle: () => void
  onChange: (spec: string | undefined) => void
  onRegenerate: () => void
}

/**
 * The Vega-Lite specification in a JSON editor, with a handle for setting its height.
 *
 * The height is this pane's own business, so it is kept here; whether the editor is expanded is
 * not, since generating a chart collapses it and choosing to write one by hand opens it.
 */
const VegaJsonEditor: React.FC<VegaJsonEditorProps> = ({
  spec,
  isValidJson,
  isShown,
  onToggle,
  onChange,
  onRegenerate,
}) => {
  const { t } = useTranslation()
  const { heightPx, handleProps } = useVerticalResizeHandle({
    initialHeightPx: DEFAULT_HEIGHT,
    minHeightPx: MIN_HEIGHT,
    maxHeightPx: MAX_HEIGHT,
    keyboardStepPx: RESIZE_STEP,
  })

  return (
    <>
      <div className={headerStyles}>
        <p className={headerLabelStyles}>{t("vega-lite-json-specification")}</p>
        <div className={headerActionsStyles}>
          {/* Always rendered: a live region has to exist before its text changes to be announced. */}
          <span
            role="status"
            className={css`
              font-size: 0.75rem;
              color: ${baseTheme.colors.red[600]};
            `}
          >
            {isValidJson ? "" : t("invalid-json")}
          </span>
          <Button
            variant="secondary"
            size="small"
            onPress={onToggle}
            domProps={{ "aria-expanded": isShown, "aria-controls": EDITOR_ID }}
          >
            {isShown ? t("hide-vega-json") : t("view-vega-json")}
          </Button>
          <Button variant="secondary" size="small" onPress={onRegenerate}>
            {t("ai-regenerate-chart")}
          </Button>
        </div>
      </div>
      {isShown && (
        <>
          <div
            id={EDITOR_ID}
            className={css`
              /* Height is teacher-controlled via the drag handle below; the modal grows to
                 include it. */
              flex: 0 0 auto;
              height: ${heightPx}px;
              border: 1px solid
                ${isValidJson ? baseTheme.colors.gray[400] : baseTheme.colors.red[400]};
              border-radius: 4px;
              overflow: hidden;
              /* MonacoEditorImpl adds a height-less wrapper div; force it to fill so the editor can
               size to this box. */
              & > div {
                height: 100%;
              }
            `}
          >
            <MonacoEditor
              height="100%"
              language={MONACO_LANGUAGE}
              value={spec}
              beforeMount={enableJsonSchemaSupport}
              onChange={onChange}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: ON,
                scrollBeyondLastLine: false,
                wordWrap: ON,
                tabSize: 2,
                // Re-measure so height: 100% tracks the container as it's resized.
                automaticLayout: true,
                // Tab moves focus out of the editor instead of inserting an indent, so the
                // dialog stays keyboard-navigable. Ctrl+M toggles it back to indenting.
                tabFocusMode: true,
              }}
            />
          </div>
          <div
            className={css`
              flex-shrink: 0;
              /* The hint only helps someone operating the handle by keyboard, so it shows while
               the handle has focus. Its space stays reserved so focusing doesn't shift the
               sections below. */
              &:focus-within > p {
                opacity: 1;
              }
            `}
          >
            <div
              role="separator"
              aria-orientation="horizontal"
              aria-controls={EDITOR_ID}
              aria-label={t("resize-vega-json-editor")}
              aria-describedby={RESIZE_HINT_ID}
              {...handleProps}
              className={css`
                height: 12px;
                cursor: row-resize;
                touch-action: none;
                user-select: none;
                display: flex;
                align-items: center;
                justify-content: center;
                /* :focus, not :focus-visible — a click focuses the handle to enable the arrow
                 keys, and that has to be visible. */
                &:focus {
                  outline: 2px solid ${baseTheme.colors.green[600]};
                  outline-offset: -2px;
                }
                /* Grip: a short bar that darkens on hover/focus. */
                &::after {
                  content: "";
                  width: 2rem;
                  height: 3px;
                  border-radius: 3px;
                  background: ${baseTheme.colors.gray[400]};
                }
                &:hover::after,
                &:focus::after {
                  background: ${baseTheme.colors.gray[600]};
                }
              `}
            />
            <p
              id={RESIZE_HINT_ID}
              className={css`
                opacity: 0;
                transition: opacity 0.15s ease;
                margin: 0.125rem 0 0;
                text-align: center;
                font-family: ${primaryFont};
                font-size: 0.75rem;
                color: ${baseTheme.colors.gray[600]};
              `}
            >
              {t("vega-json-resize-hint")}
            </p>
          </div>
        </>
      )}
    </>
  )
}

export default VegaJsonEditor
