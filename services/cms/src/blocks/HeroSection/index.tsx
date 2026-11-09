"use client"

/* oxlint-disable i18next/no-literal-string */

import { baseTheme } from "@/shared-module/common/styles"
import { HEX_COLOR_OR_EMPTY, URL_REFERENCE } from "@/utils/Gutenberg/agentSchema"
import type { BlockConfiguration } from "@/utils/Gutenberg/types"

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
  backgroundImageMedium: string | undefined
  backgroundImageLarge: string | undefined
  backgroundImageXLarge: string | undefined
  backgroundRepeatX: boolean | undefined
  alignCenter?: boolean | undefined
  alignBottom?: boolean | undefined
  useDefaultTextForLabel?: boolean | undefined
  partiallyTransparent?: boolean | undefined
}

const HeroSectionConfiguration: BlockConfiguration<HeroSectionAttributes> = {
  apiVersion: 3,
  title: "Hero Section",
  description: "A hero section for chapter front page with a heading and sub-heading.",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {
    label: {
      type: "string",
      isRichText: true,
      default: "Chapter number...",
    },
    title: {
      type: "string",
      isRichText: true,
      default: "Hero section title...",
    },
    subtitle: {
      type: "string",
      isRichText: true,
      default: "Hero section subtitle...",
    },
    backgroundColor: {
      type: "string",
      agentSchema: HEX_COLOR_OR_EMPTY,
      default: baseTheme.colors.green[200],
    },
    fontColor: {
      type: "string",
      agentSchema: HEX_COLOR_OR_EMPTY,
      default: baseTheme.colors.gray[700],
    },
    backgroundImage: {
      type: "string",
      agentSchema: URL_REFERENCE,
      default: undefined,
    },
    backgroundImageMedium: {
      type: "string",
      agentSchema: URL_REFERENCE,
      default: undefined,
    },
    backgroundImageLarge: {
      type: "string",
      agentSchema: URL_REFERENCE,
      default: undefined,
    },
    backgroundImageXLarge: {
      type: "string",
      agentSchema: URL_REFERENCE,
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
