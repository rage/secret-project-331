"use client"

/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import Editor from "@monaco-editor/react"
import React from "react"

import BlockWrapper from "../BlockWrapper"

import { ChartBlockAttributes, DEFAULT_VEGA_LITE_SPEC } from "."

import Button from "@/shared-module/common/components/Button"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import { baseTheme, fontWeights, primaryFont } from "@/shared-module/common/styles"
import type { BlockEditProps } from "@/utils/Gutenberg/types"

const ChartBlockEditor: React.FC<React.PropsWithChildren<BlockEditProps<ChartBlockAttributes>>> = ({
  clientId,
  attributes,
  setAttributes,
}) => {
  const { spec, caption } = attributes

  const handleSpecChange = (value: string | undefined) => {
    setAttributes({ spec: value ?? "" })
  }

  const isValidJson = (() => {
    try {
      JSON.parse(spec)
      return true
    } catch {
      return false
    }
  })()

  return (
    <BlockWrapper id={clientId}>
      <div
        className={css`
          background: #fafbfb;
          border: 1px solid #e2e4e6;
          padding: 1rem;
        `}
      >
        <div
          className={css`
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 0.5rem;
          `}
        >
          <p
            className={css`
              margin: 0;
              font-family: ${primaryFont};
              font-size: 0.8125rem;
              color: ${baseTheme.colors.gray[700]};
              font-weight: ${fontWeights.medium};
            `}
          >
            Vega-Lite JSON specification
          </p>
          <div
            className={css`
              display: flex;
              align-items: center;
              gap: 0.5rem;
            `}
          >
            {!isValidJson && (
              <span
                className={css`
                  font-size: 0.75rem;
                  color: ${baseTheme.colors.red[600]};
                `}
              >
                Invalid JSON
              </span>
            )}
            <Button
              variant="secondary"
              size="small"
              onClick={() => setAttributes({ spec: DEFAULT_VEGA_LITE_SPEC })}
            >
              Reset to example
            </Button>
          </div>
        </div>
        <div
          className={css`
            border: 1px solid
              ${isValidJson ? baseTheme.colors.gray[400] : baseTheme.colors.red[400]};
            border-radius: 4px;
            overflow: hidden;
          `}
        >
          <Editor
            height="320px"
            language="json"
            value={spec}
            onChange={handleSpecChange}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              wordWrap: "on",
              tabSize: 2,
            }}
          />
        </div>
        <div
          className={css`
            margin-top: 1rem;
          `}
        >
          <TextField
            label="Caption (optional)"
            value={caption}
            onChangeByValue={(value) => setAttributes({ caption: value })}
            placeholder="Describe the chart"
          />
        </div>
      </div>
    </BlockWrapper>
  )
}

export default ChartBlockEditor
