/* eslint-disable @typescript-eslint/no-empty-interface */
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

export interface GalleryAttributes {
  images: unknown[]
  ids: number[]
  columns?: number
  caption?: string
  imageCrop: boolean
  linkTo?: string
  sizeSlug: string
  align?: "left" | "center" | "right" | "wide" | "full" | ""
  anchor?: string
  className?: string
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

export interface ArchivesAttributes {
  displayAsDropdown: boolean
  showPostCounts: boolean
  align?: "left" | "center" | "right" | "wide" | "full" | ""
  className?: string
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

export interface CalendarAttributes {
  month?: number
  year?: number
  align?: "left" | "center" | "right" | "wide" | "full" | ""
  className?: string
}

export interface CategoriesAttributes {
  displayAsDropdown: boolean
  showHierarchy: boolean
  showPostCounts: boolean
  align?: "left" | "center" | "right" | "wide" | "full" | ""
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

export interface CoverAttributes {
  url?: string
  id?: number
  hasParallax: boolean
  isRepeated: boolean
  dimRatio: number
  overlayColor?: string
  customOverlayColor?: string
  backgroundType: string
  focalPoint?: {
    [k: string]: unknown
  }
  minHeight?: number
  minHeightUnit?: string
  gradient?: string
  customGradient?: string
  contentPosition?: string
  align?: "left" | "center" | "right" | "wide" | "full" | ""
  anchor?: string
  className?: string
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

export interface MediaTextAttributes {
  align: string
  mediaAlt: string
  mediaPosition: string
  mediaId?: number
  mediaUrl?: string
  mediaLink?: string
  linkDestination?: string
  linkTarget?: string
  href?: string
  rel?: string
  linkClass?: string
  mediaType?: string
  mediaWidth: number
  mediaSizeSlug?: string
  isStackedOnMobile: boolean
  verticalAlignment?: string
  imageFill?: boolean
  focalPoint?: {
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
}

export interface LatestCommentsAttributes {
  commentsToShow: number
  displayAvatar: boolean
  displayDate: boolean
  displayExcerpt: boolean
  align?: "left" | "center" | "right" | "wide" | "full" | ""
  className?: string
}

export interface LatestPostsAttributes {
  categories?: {
    [k: string]: unknown
  }[]
  selectedAuthor?: number
  postsToShow: number
  displayPostContent: boolean
  displayPostContentRadio: string
  excerptLength: number
  displayAuthor: boolean
  displayPostDate: boolean
  postLayout: string
  columns: number
  order: string
  orderBy: string
  displayFeaturedImage: boolean
  featuredImageAlign?: "left" | "center" | "right"
  featuredImageSizeSlug: string
  featuredImageSizeWidth: number
  featuredImageSizeHeight: number
  addLinkToFeaturedImage: boolean
  align?: "left" | "center" | "right" | "wide" | "full" | ""
  className?: string
}

export interface LegacyWidgetAttributes {
  id: string
  idBase: string
  instance: {
    [k: string]: unknown
  }
}

export interface MissingAttributes {
  originalName?: string
  originalUndelimitedContent?: string
  originalContent?: string
}

export interface MoreAttributes {
  customText?: string
  noTeaser: boolean
}

export interface NextpageAttributes {}

export interface PageListAttributes {
  className?: string
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

export interface SearchAttributes {
  label?: string
  showLabel: boolean
  placeholder: string
  width?: number
  widthUnit?: string
  buttonText?: string
  buttonPosition: string
  buttonUseIcon: boolean
  align?: "left" | "center" | "right" | "wide" | "full" | ""
  className?: string
  style?: {
    [k: string]: unknown
  }
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

export interface SocialLinksAttributes {
  iconColor?: string
  customIconColor?: string
  iconColorValue?: string
  iconBackgroundColor?: string
  customIconBackgroundColor?: string
  iconBackgroundColorValue?: string
  openInNewTab: boolean
  size?: string
  align?: "left" | "center" | "right" | "wide" | "full" | ""
  anchor?: string
  className?: string
}

export interface SocialLinkAttributes {
  url?: string
  service?: string
  label?: string
  className?: string
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
  head: unknown[]
  body: unknown[]
  foot: unknown[]
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

export interface TagCloudAttributes {
  taxonomy: string
  showTagCounts: boolean
  align?: "left" | "center" | "right" | "wide" | "full" | ""
  className?: string
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

export interface VideoAttributes {
  autoplay?: boolean
  caption?: string
  controls: boolean
  id?: number
  loop?: boolean
  muted?: boolean
  poster?: string
  preload: string
  src?: string
  playsInline?: boolean
  tracks: {
    [k: string]: unknown
  }[]
  align?: "left" | "center" | "right" | "wide" | "full" | ""
  anchor?: string
  className?: string
}

export interface SiteLogoAttributes {
  align?: string
  width?: number
  isLink: boolean
  linkTarget: string
  className?: string
}

export interface SiteTaglineAttributes {
  textAlign?: string
  className?: string
  backgroundColor?: string
  textColor?: string
  gradient?: string
  fontSize?: string
  style?: {
    [k: string]: unknown
  }
}

export interface SiteTitleAttributes {
  level: number
  textAlign?: string
  align?: "left" | "center" | "right" | "wide" | "full" | ""
  className?: string
  backgroundColor?: string
  textColor?: string
  gradient?: string
  fontSize?: string
  style?: {
    [k: string]: unknown
  }
}

export interface QueryAttributes {
  queryId?: number
  query: {
    [k: string]: unknown
  }
  tagName: string
  displayLayout: {
    [k: string]: unknown
  }
  align?: "left" | "center" | "right" | "wide" | "full" | ""
  className?: string
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

export interface QueryLoopAttributes {
  align?: "left" | "center" | "right" | "wide" | "full" | ""
  className?: string
}

export interface QueryTitleAttributes {
  type?: string
  textAlign?: string
  level: number
  align?: "left" | "center" | "right" | "wide" | "full" | ""
  className?: string
  backgroundColor?: string
  textColor?: string
  gradient?: string
  fontSize?: string
  style?: {
    [k: string]: unknown
  }
}

export interface QueryPaginationAttributes {
  align?: "left" | "center" | "right" | "wide" | "full" | ""
  className?: string
  backgroundColor?: string
  textColor?: string
  gradient?: string
  style?: {
    [k: string]: unknown
  }
}

export interface QueryPaginationNextAttributes {
  label?: string
  className?: string
  backgroundColor?: string
  textColor?: string
  gradient?: string
  fontSize?: string
  style?: {
    [k: string]: unknown
  }
}

export interface QueryPaginationNumbersAttributes {
  className?: string
}

export interface QueryPaginationPreviousAttributes {
  label?: string
  className?: string
  backgroundColor?: string
  textColor?: string
  gradient?: string
  fontSize?: string
  style?: {
    [k: string]: unknown
  }
}

export interface PostTitleAttributes {
  textAlign?: string
  level: number
  isLink: boolean
  rel: string
  linkTarget: string
  align?: "left" | "center" | "right" | "wide" | "full" | ""
  className?: string
  backgroundColor?: string
  textColor?: string
  gradient?: string
  fontSize?: string
  style?: {
    [k: string]: unknown
  }
}

export interface PostContentAttributes {
  align?: "left" | "center" | "right" | "wide" | "full" | ""
  className?: string
  layout?: {
    [k: string]: unknown
  }
}

export interface PostDateAttributes {
  textAlign?: string
  format?: string
  isLink: boolean
  className?: string
  backgroundColor?: string
  textColor?: string
  gradient?: string
  fontSize?: string
  style?: {
    [k: string]: unknown
  }
}

export interface PostExcerptAttributes {
  textAlign?: string
  wordCount: number
  moreText?: string
  showMoreOnNewLine: boolean
  className?: string
  backgroundColor?: string
  textColor?: string
  gradient?: string
  fontSize?: string
  style?: {
    [k: string]: unknown
  }
}

export interface PostFeaturedImageAttributes {
  isLink: boolean
  align?: "left" | "center" | "right" | "wide" | "full" | ""
  className?: string
}

export interface PostTermsAttributes {
  term?: string
  textAlign?: string
  className?: string
  backgroundColor?: string
  textColor?: string
  gradient?: string
  fontSize?: string
  style?: {
    [k: string]: unknown
  }
}

export interface LoginoutAttributes {
  displayLoginAsForm: boolean
  redirectToCurrent: boolean
  className?: string
}
