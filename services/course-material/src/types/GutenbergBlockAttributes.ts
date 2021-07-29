/* eslint-disable @typescript-eslint/no-empty-interface */

export interface TextAttributes {
  text: string
}
export interface ParagraphAttributes {
  align?: string
  content: string
  dropCap: boolean
  placeholder?: string
  direction?: "ltr" | "rtl"
  anchor?: string
  className?: string
  backgroundColor?: string
  textColor?: string
  fontSize?: string
  style?: {
    [k: string]: unknown
  }
}

export interface ImageAttributes {
  align?: string
  url?: string
  alt: string
  caption?: string
  title?: string
  href?: string
  rel?: string
  linkClass?: string
  id?: number
  width?: number
  height?: number
  sizeSlug?: string
  linkDestination: string
  linkTarget?: string
  anchor?: string
  className?: string
  style?: {
    [k: string]: unknown
  }
  blurDataUrl: string
}

export interface HeadingAttributes {
  textAlign?: string
  content: string
  level: number
  placeholder?: string
  align?: "left" | "center" | "right" | "wide" | "full" | ""
  anchor?: string
  className?: string
  backgroundColor?: string
  textColor?: string
  fontSize?: string
  style?: {
    [k: string]: unknown
  }
}

export interface ListAttributes {
  ordered: boolean
  values: string
  type?: string
  start?: number
  reversed?: boolean
  placeholder?: string
  anchor?: string
  className?: string
  backgroundColor?: string
  textColor?: string
  gradient?: string
  fontSize?: string
  style?: {
    [k: string]: unknown
  }
}

export interface QuoteAttributes {
  value: string
  citation: string
  align?: string
  anchor?: string
  className?: string
}

export interface ShortcodeAttributes {
  text?: string
}

export interface AudioAttributes {
  src?: string
  caption?: string
  id?: number
  autoplay?: boolean
  loop?: boolean
  preload?: string
  align?: "left" | "center" | "right" | "wide" | "full" | ""
  anchor?: string
  className?: string
}

export interface ButtonAttributes {
  url?: string
  title?: string
  text?: string
  linkTarget?: string
  rel?: string
  placeholder?: string
  backgroundColor?: string
  textColor?: string
  gradient?: string
  width?: number
  align?: "left" | "center" | "right" | "wide" | "full" | ""
  anchor?: string
  className?: string
  fontSize?: string
  style?: {
    [k: string]: unknown
  }
}

export interface ButtonsAttributes {
  contentJustification?: string
  orientation: string
  align?: "left" | "center" | "right" | "wide" | "full" | ""
  anchor?: string
  className?: string
}

export interface CodeAttributes {
  content?: string
  anchor?: string
  className?: string
  fontSize?: string
  style?: {
    [k: string]: unknown
  }
}

export interface ColumnsAttributes {
  verticalAlignment?: string
  align?: "left" | "center" | "right" | "wide" | "full" | ""
  anchor?: string
  className?: string
  backgroundColor?: string
  textColor?: string
  gradient?: string
  style?: {
    [k: string]: unknown
  }
}

export interface ColumnAttributes {
  verticalAlignment?: string
  width?: string
  templateLock?: "all" | "insert" | false
  anchor?: string
  className?: string
  backgroundColor?: string
  textColor?: string
  gradient?: string
  style?: {
    [k: string]: unknown
  }
}

export interface EmbedAttributes {
  url?: string
  caption?: string
  type?: string
  providerNameSlug?: string
  allowResponsive: boolean
  responsive: boolean
  previewable: boolean
  align?: "left" | "center" | "right" | "wide" | "full" | ""
  className?: string
}

export interface FileAttributes {
  id?: number
  href?: string
  fileName?: string
  textLinkHref?: string
  textLinkTarget?: string
  showDownloadButton: boolean
  downloadButtonText?: string
  displayPreview?: boolean
  previewHeight: number
  align?: "left" | "center" | "right" | "wide" | "full" | ""
  anchor?: string
  className?: string
}

export interface GroupAttributes {
  tagName: string
  templateLock?: "all" | "insert" | false
  align?: "left" | "center" | "right" | "wide" | "full" | ""
  anchor?: string
  className?: string
  borderColor?: string
  backgroundColor?: string
  textColor?: string
  gradient?: string
  style?: {
    [k: string]: unknown
  }
  layout?: {
    [k: string]: unknown
  }
}

export interface HtmlAttributes {
  content?: string
}

export interface PreformattedAttributes {
  content: string
  anchor?: string
  className?: string
  backgroundColor?: string
  textColor?: string
  gradient?: string
  fontSize?: string
  style?: {
    [k: string]: unknown
  }
}

export interface PullquoteAttributes {
  value?: string
  citation: string
  mainColor?: string
  customMainColor?: string
  textColor?: string
  customTextColor?: string
  align?: "left" | "center" | "right" | "wide" | "full" | ""
  anchor?: string
  className?: string
}

export interface RssAttributes {
  columns: number
  blockLayout: string
  feedURL: string
  itemsToShow: number
  displayExcerpt: boolean
  displayAuthor: boolean
  displayDate: boolean
  excerptLength: number
  align?: "left" | "center" | "right" | "wide" | "full" | ""
  className?: string
}

export interface SeparatorAttributes {
  color?: string
  customColor?: string
  align?: "left" | "center" | "right" | "wide" | "full" | ""
  anchor?: string
  className?: string
}

export interface BlockAttributes {
  ref?: number
}

export interface SpacerAttributes {
  height: number
  width?: number
  anchor?: string
  className?: string
}

export interface TableAttributes {
  hasFixedLayout: boolean
  caption: string
  head: Array<{ cells: Array<{ tag: string; content: string }> }>
  body: Array<{ cells: Array<{ tag: string; content: string }> }>
  foot: Array<{ cells: Array<{ tag: string; content: string }> }>
  align?: "left" | "center" | "right" | "wide" | "full" | ""
  anchor?: string
  className?: string
  borderColor?: string
  backgroundColor?: string
  textColor?: string
  gradient?: string
  style?: {
    [k: string]: unknown
  }
}

export interface TextColumnsAttributes {
  content: unknown[]
  columns: number
  width?: string
  className?: string
}

export interface VerseAttributes {
  content: string
  textAlign?: string
  anchor?: string
  className?: string
  backgroundColor?: string
  textColor?: string
  gradient?: string
  fontSize?: string
  style?: {
    [k: string]: unknown
  }
}

export interface CoverAttributes {
  overlayColor: string
  contentPosition: string
  backgroundType: boolean
  dimRatio: number
  hasParallax: boolean
  isRepeated: boolean
}
