/* eslint-disable @typescript-eslint/no-empty-interface */

// ###########################################
// ## This file is autogenerated by running ##
// ## 'bin/extract-gutenberg-types'         ##
// ## in the root of the repo.              ##
// ##                                       ##
// ## Do not edit this file by hand.        ##
// ###########################################

import type { StringWithHTML } from "."

export interface AudioAttributes {
  blob?: string
  src?: string
  caption?: StringWithHTML
  id?: number
  autoplay?: boolean
  loop?: boolean
  preload?: string
}

export interface BlockAttributes {
  ref?: number
  content: {
    [k: string]: unknown
  }
}

export interface ButtonAttributes {
  tagName: "a" | "button"
  type: string
  textAlign?: string
  url?: string
  title?: string
  text?: StringWithHTML
  linkTarget?: string
  rel?: string
  placeholder?: string
  backgroundColor?: string
  textColor?: string
  gradient?: string
  width?: number
}

export interface ButtonsAttributes {}

export interface CodeAttributes {
  content?: StringWithHTML
}

export interface ColumnAttributes {
  verticalAlignment?: string
  width?: string
  allowedBlocks?: unknown[]
  templateLock?: "all" | "insert" | "contentOnly" | false
}

export interface ColumnsAttributes {
  verticalAlignment?: string
  isStackedOnMobile: boolean
  templateLock?: "all" | "insert" | "contentOnly" | false
}

export interface EmbedAttributes {
  url?: string
  caption?: StringWithHTML
  type?: string
  providerNameSlug?: string
  allowResponsive: boolean
  responsive: boolean
  previewable: boolean
}

export interface FileAttributes {
  id?: number
  blob?: string
  href?: string
  fileId?: string
  fileName?: StringWithHTML
  textLinkHref?: string
  textLinkTarget?: string
  showDownloadButton: boolean
  downloadButtonText?: StringWithHTML
  displayPreview?: boolean
  previewHeight: number
}

export interface HeadingAttributes {
  textAlign?: string
  content?: StringWithHTML
  level: number
  levelOptions?: unknown[]
  placeholder?: string
}

export interface HtmlAttributes {
  content?: string
}

export interface ImageAttributes {
  blob?: string
  url?: string
  alt: string
  caption?: StringWithHTML
  lightbox?: {
    [k: string]: unknown
  }
  title?: string
  href?: string
  rel?: string
  linkClass?: string
  id?: number
  width?: string
  height?: string
  aspectRatio?: string
  scale?: string
  sizeSlug?: string
  linkDestination?: string
  linkTarget?: string
}

export interface ListAttributes {
  ordered: boolean
  values: string
  type?: string
  start?: number
  reversed?: boolean
  placeholder?: string
}

export interface ListItemAttributes {
  placeholder?: string
  content?: StringWithHTML
}

export interface ParagraphAttributes {
  align?: string
  content?: StringWithHTML
  dropCap: boolean
  placeholder?: string
  direction?: "ltr" | "rtl"
}

export interface PreformattedAttributes {
  content?: StringWithHTML
}

export interface PullquoteAttributes {
  value?: StringWithHTML
  citation?: StringWithHTML
  textAlign?: string
}

export interface QuoteAttributes {
  value: string
  citation?: StringWithHTML
  textAlign?: string
}

export interface SeparatorAttributes {
  opacity: string
}

export interface SpacerAttributes {
  height: string
  width?: string
}

export interface TableAttributes {
  hasFixedLayout: boolean
  caption?: StringWithHTML
  head: Cells[]
  body: Cells[]
  foot: Cells[]
}
export interface Cells {
  cells?: CellAttributes[]
}
export interface CellAttributes {
  content?: StringWithHTML
  tag?: string
  scope?: string
  align?: string
  colspan?: string
  rowspan?: string
}

export interface VerseAttributes {
  content?: StringWithHTML
  textAlign?: string
}
