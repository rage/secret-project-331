"use client"

/* eslint-disable i18next/no-literal-string */
import { image as icon } from "@wordpress/icons"

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

import ChartBlockEditor from "./ChartBlockEditor"
import ChartBlockSave from "./ChartBlockSave"
import { DEFAULT_CHART_HEIGHT, VEGA_LITE_SCHEMA_URL } from "./chartSpec"

export interface ChartBlockAttributes {
  spec: string
  caption: string
  /** Chart height in pixels; width is responsive. */
  height: number
}

export { DEFAULT_CHART_HEIGHT }

// Served from main-frontend's public/ at the site root, so both the cms editor and the
// course-material renderer can load it by this URL.
export const EXAMPLE_DATA_URL = "/chart-block-example-data.json"

export const DEFAULT_VEGA_LITE_SPEC = JSON.stringify(
  {
    $schema: VEGA_LITE_SCHEMA_URL,
    description: "A simple bar chart",
    data: { url: EXAMPLE_DATA_URL, format: { type: "json" } },
    mark: "bar",
    encoding: {
      x: { field: "category", type: "nominal", axis: { labelAngle: 0 } },
      y: { field: "value", type: "quantitative" },
    },
  },
  null,
  2,
)

const ChartBlockConfiguration: BlockConfiguration<ChartBlockAttributes> = {
  title: "ChartBlock",
  description: "Renders a Vega-Lite chart from a JSON specification",
  category: "text",
  attributes: {
    spec: {
      type: "string",
      default: DEFAULT_VEGA_LITE_SPEC,
    },
    caption: {
      type: "string",
      default: "",
    },
    height: {
      type: "number",
      default: DEFAULT_CHART_HEIGHT,
    },
  },
  icon,
  edit: ChartBlockEditor,
  save: ChartBlockSave,
}

export default ChartBlockConfiguration
