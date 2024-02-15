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
  src?: string
  caption?: StringWithHTML
  id?: number
  autoplay?: boolean
  loop?: boolean
  preload?: string
  align?: "left" | "center" | "right" | "wide" | "full" | ""
  lock?: {
    [k: string]: unknown
  }
  anchor?: string
  className?: string
  style?: {
    [k: string]: unknown
  }
  metadata?: {
    [k: string]: unknown
  }
}

export interface BlockAttributes {
  ref?: number
  overrides?: {
    [k: string]: unknown
  }
  lock?: {
    [k: string]: unknown
  }
  metadata?: {
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
  lock?: {
    [k: string]: unknown
  }
  anchor?: string
  className?: string
  borderColor?: string
  fontFamily?: string
  fontSize?: string
  style?: {
    [k: string]: unknown
  }
  metadata?: {
    [k: string]: unknown
  }
}

export interface ButtonsAttributes {
  align?: "left" | "center" | "right" | "wide" | "full" | ""
  lock?: {
    [k: string]: unknown
  }
  anchor?: string
  className?: string
  fontFamily?: string
  fontSize?: string
  style?: {
    [k: string]: unknown
  }
  layout?: {
    [k: string]: unknown
  }
  metadata?: {
    [k: string]: unknown
  }
}

export interface CodeAttributes {
  content?: StringWithHTML
  align?: "left" | "center" | "right" | "wide" | "full" | ""
  lock?: {
    [k: string]: unknown
  }
  anchor?: string
  className?: string
  borderColor?: string
  backgroundColor?: string
  textColor?: string
  gradient?: string
  fontFamily?: string
  fontSize?: string
  style?: {
    [k: string]: unknown
  }
  metadata?: {
    [k: string]: unknown
  }
}

export interface ColumnAttributes {
  verticalAlignment?: string
  width?: string
  allowedBlocks?: unknown[]
  templateLock?: "all" | "insert" | "contentOnly" | false
  lock?: {
    [k: string]: unknown
  }
  anchor?: string
  className?: string
  borderColor?: string
  backgroundColor?: string
  textColor?: string
  gradient?: string
  fontFamily?: string
  fontSize?: string
  style?: {
    [k: string]: unknown
  }
  layout?: {
    [k: string]: unknown
  }
  metadata?: {
    [k: string]: unknown
  }
}

export interface ColumnsAttributes {
  verticalAlignment?: string
  isStackedOnMobile: boolean
  templateLock?: "all" | "insert" | "contentOnly" | false
  align?: "left" | "center" | "right" | "wide" | "full" | ""
  lock?: {
    [k: string]: unknown
  }
  anchor?: string
  className?: string
  borderColor?: string
  backgroundColor?: string
  textColor?: string
  gradient?: string
  fontFamily?: string
  fontSize?: string
  style?: {
    [k: string]: unknown
  }
  layout?: {
    [k: string]: unknown
  }
  metadata?: {
    [k: string]: unknown
  }
}

export interface EmbedAttributes {
  url?: string
  caption?: StringWithHTML
  type?: string
  providerNameSlug?: string
  allowResponsive: boolean
  responsive: boolean
  previewable: boolean
  align?: "left" | "center" | "right" | "wide" | "full" | ""
  lock?: {
    [k: string]: unknown
  }
  className?: string
  style?: {
    [k: string]: unknown
  }
  metadata?: {
    [k: string]: unknown
  }
  height?: number
  title?: string
}

export interface FileAttributes {
  id?: number
  href?: string
  fileId?: string
  fileName?: StringWithHTML
  textLinkHref?: string
  textLinkTarget?: string
  showDownloadButton: boolean
  downloadButtonText?: StringWithHTML
  displayPreview?: boolean
  previewHeight: number
  align?: "left" | "center" | "right" | "wide" | "full" | ""
  lock?: {
    [k: string]: unknown
  }
  anchor?: string
  className?: string
  backgroundColor?: string
  textColor?: string
  gradient?: string
  style?: {
    [k: string]: unknown
  }
  metadata?: {
    [k: string]: unknown
  }
}

export interface HeadingAttributes {
  textAlign?: string
  content?: StringWithHTML
  level: number
  placeholder?: string
  align?: "left" | "center" | "right" | "wide" | "full" | ""
  lock?: {
    [k: string]: unknown
  }
  anchor?: string
  className?: string
  backgroundColor?: string
  textColor?: string
  gradient?: string
  fontFamily?: string
  fontSize?: string
  style?: {
    [k: string]: unknown
  }
  metadata?: {
    [k: string]: unknown
  }
}

export interface HtmlAttributes {
  content?: string
  lock?: {
    [k: string]: unknown
  }
  metadata?: {
    [k: string]: unknown
  }
}

export interface ImageAttributes {
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
  linkDestination: string
  linkTarget?: string
  align?: "left" | "center" | "right" | "wide" | "full" | ""
  lock?: {
    [k: string]: unknown
  }
  anchor?: string
  className?: string
  borderColor?: string
  style?: {
    [k: string]: unknown
  }
  metadata?: {
    [k: string]: unknown
  }
  blurDataUrl: string
}

export interface ListAttributes {
  ordered: boolean
  values: string
  type?: string
  start?: number
  reversed?: boolean
  placeholder?: string
  lock?: {
    [k: string]: unknown
  }
  anchor?: string
  className?: string
  backgroundColor?: string
  textColor?: string
  gradient?: string
  fontFamily?: string
  fontSize?: string
  style?: {
    [k: string]: unknown
  }
  metadata?: {
    [k: string]: unknown
  }
}

export interface ListItemAttributes {
  placeholder?: string
  content?: StringWithHTML
  lock?: {
    [k: string]: unknown
  }
  className?: string
  fontFamily?: string
  fontSize?: string
  style?: {
    [k: string]: unknown
  }
  metadata?: {
    [k: string]: unknown
  }
}

export interface ParagraphAttributes {
  align?: string
  content?: StringWithHTML
  dropCap: boolean
  placeholder?: string
  direction?: "ltr" | "rtl"
  lock?: {
    [k: string]: unknown
  }
  anchor?: string
  className?: string
  backgroundColor?: string
  textColor?: string
  gradient?: string
  fontFamily?: string
  fontSize?: string
  style?: {
    [k: string]: unknown
  }
  metadata?: {
    [k: string]: unknown
  }
}

export interface PreformattedAttributes {
  content?: StringWithHTML
  lock?: {
    [k: string]: unknown
  }
  anchor?: string
  className?: string
  backgroundColor?: string
  textColor?: string
  gradient?: string
  fontFamily?: string
  fontSize?: string
  style?: {
    [k: string]: unknown
  }
  metadata?: {
    [k: string]: unknown
  }
}

export interface PullquoteAttributes {
  value?: StringWithHTML
  citation?: StringWithHTML
  textAlign?: string
  align?: "left" | "center" | "right" | "wide" | "full" | ""
  lock?: {
    [k: string]: unknown
  }
  anchor?: string
  className?: string
  borderColor?: string
  backgroundColor?: string
  textColor?: string
  gradient?: string
  fontFamily?: string
  fontSize?: string
  style?: {
    [k: string]: unknown
  }
  metadata?: {
    [k: string]: unknown
  }
}

export interface QuoteAttributes {
  value: string
  citation?: StringWithHTML
  align?: string
  lock?: {
    [k: string]: unknown
  }
  anchor?: string
  className?: string
  backgroundColor?: string
  textColor?: string
  gradient?: string
  fontFamily?: string
  fontSize?: string
  style?: {
    [k: string]: unknown
  }
  layout?: {
    [k: string]: unknown
  }
  metadata?: {
    [k: string]: unknown
  }
}

export interface SeparatorAttributes {
  opacity: string
  align?: "left" | "center" | "right" | "wide" | "full" | ""
  lock?: {
    [k: string]: unknown
  }
  anchor?: string
  className?: string
  backgroundColor?: string
  textColor?: string
  gradient?: string
  style?: {
    [k: string]: unknown
  }
  metadata?: {
    [k: string]: unknown
  }
}

export interface SpacerAttributes {
  height: string
  width?: string
  lock?: {
    [k: string]: unknown
  }
  anchor?: string
  className?: string
  style?: {
    [k: string]: unknown
  }
  metadata?: {
    [k: string]: unknown
  }
}

export interface TableAttributes {
  hasFixedLayout: boolean
  caption?: StringWithHTML
  head: Cells[]
  body: Cells[]
  foot: Cells[]
  align?: "left" | "center" | "right" | "wide" | "full" | ""
  lock?: {
    [k: string]: unknown
  }
  anchor?: string
  className?: string
  borderColor?: string
  backgroundColor?: string
  textColor?: string
  gradient?: string
  fontFamily?: string
  fontSize?: string
  style?: {
    [k: string]: unknown
  }
  metadata?: {
    [k: string]: unknown
  }
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
  lock?: {
    [k: string]: unknown
  }
  anchor?: string
  className?: string
  borderColor?: string
  backgroundColor?: string
  textColor?: string
  gradient?: string
  fontFamily?: string
  fontSize?: string
  style?: {
    [k: string]: unknown
  }
  metadata?: {
    [k: string]: unknown
  }
}
