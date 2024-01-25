/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"

import { baseTheme } from "../../shared-module/common/styles"
import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"

import HeroSectionEditor from "./HeroSectionEditor"
import HeroSectionSave from "./HeroSectionSave"

export interface HeroSectionAttributes {
  title: string
  subtitle: string
  label: string
  backgroundColor: string | undefined
  fontColor: string | undefined
  backgroundImage: string | undefined
  backgroundRepeatX: boolean | undefined
  alignCenter?: boolean | undefined
  alignBottom?: boolean | undefined
  useDefaultTextForLabel?: boolean | undefined
  partiallyTransparent?: boolean | undefined
}

const HeroSectionConfiguration: BlockConfiguration<HeroSectionAttributes> = {
  title: "Hero Section",
  description: "A hero section for chapter front page with a heading and sub-heading.",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {
    label: {
      type: "string",
      source: "html",
      selector: "h6",
      default: "Chapter number...",
    },
    title: {
      type: "string",
      source: "html",
      selector: "h2",
      default: "Hero section title...",
    },
    subtitle: {
      type: "string",
      source: "html",
      selector: "h3",
      default: "Hero section subtitle...",
    },
    backgroundColor: {
      type: "string",
      default: baseTheme.colors.green[200],
    },
    fontColor: {
      type: "string",
      default: baseTheme.colors.gray[700],
    },
    backgroundImage: {
      type: "string",
      default: undefined,
    },
    backgroundRepeatX: {
      type: "boolean",
      default: false,
    },
    alignCenter: {
      type: "boolean",
      default: true,
    },
    useDefaultTextForLabel: {
      type: "boolean",
      default: true,
    },
    partiallyTransparent: {
      type: "boolean",
      default: true,
    },
    alignBottom: {
      type: "boolean",
      default: false,
    },
  },
  edit: HeroSectionEditor,
  save: HeroSectionSave,
}

export default HeroSectionConfiguration
