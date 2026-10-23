"use client"

/* oxlint-disable i18next/no-literal-string */

import { HEX_COLOR_OR_EMPTY, URL_REFERENCE } from "@/utils/Gutenberg/agentSchema"
import type { BlockConfiguration } from "@/utils/Gutenberg/types"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"
import LandingPageHeroSectionEditor from "./LandingPageHeroSectionEditor"
import LandingPageHeroSectionSave from "./LandingPageHeroSectionSave"

export interface LandingPageHeroSectionAttributes {
  title: string
  backgroundColor: string | undefined
  fontColor: string | undefined
  backgroundImage: string | undefined
  backgroundImageMedium: string | undefined
  backgroundImageLarge: string | undefined
  backgroundImageXLarge: string | undefined
  backgroundRepeatX: boolean | undefined
}

const LandingPageHeroSectionConfiguration: BlockConfiguration<LandingPageHeroSectionAttributes> = {
  apiVersion: 3,
  title: "Landing Page Hero Section",
  description:
    "Landing page hero section is a full screen section typically consisting of a background image, or animations, with text and sometimes a call to action.",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {
    title: {
      type: "string",
      isRichText: true,
      default: "Welcome message for course...",
    },
    backgroundColor: {
      type: "string",
      agentSchema: HEX_COLOR_OR_EMPTY,
      default: "#FFFFFF",
    },
    fontColor: {
      type: "string",
      agentSchema: HEX_COLOR_OR_EMPTY,
      default: "#000000",
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
  },
  allowedBlocks: ["core/heading", "core/paragraph"],
  innerBlocksArea: {
    template: [
      [
        "core/paragraph",
        {
          content: "Insert sales speech...",
          placeholder: "Insert sales speech...",
          align: "center",
        },
      ],
    ],
    templateLock: "all",
  },
  edit: LandingPageHeroSectionEditor,
  save: LandingPageHeroSectionSave,
}

export default LandingPageHeroSectionConfiguration
