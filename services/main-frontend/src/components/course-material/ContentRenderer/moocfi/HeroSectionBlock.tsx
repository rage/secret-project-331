"use client"

import { useAtomValue } from "jotai"
import React from "react"

import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import { omitUndefined } from "@/shared-module/common/utils/nullability"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { currentPageDataAtom } from "@/state/course-material/selectors"

import type { BlockRendererProps } from ".."
import type { HeroSectionProps } from "../../HeroSection"
import HeroSection from "../../HeroSection"
const HeroSectionBlock: React.FC<React.PropsWithChildren<BlockRendererProps<HeroSectionProps>>> = (
  props,
) => {
  const DEFAULT = true
  const pageData = useAtomValue(currentPageDataAtom)
  const path = pageData?.url_path
  const formattedPath = path?.replace("-", " ").replace("/", "")
  const useDefaultTextForLabel = props.data.attributes.useDefaultTextForLabel ?? DEFAULT
  const isChapterFrontpage = pageData?.chapter_id
  const partiallyTransparent = props.data.attributes.partiallyTransparent ?? DEFAULT

  const chapterNumber =
    useDefaultTextForLabel && formattedPath && isChapterFrontpage
      ? formattedPath
      : props.data.attributes.label

  return (
    <BreakFromCentered sidebar={false}>
      <HeroSection
        {...omitUndefined({ label: chapterNumber })}
        title={props.data.attributes.title}
        subtitle={props.data.attributes.subtitle}
        {...omitUndefined({ backgroundImage: props.data.attributes.backgroundImage })}
        partiallyTransparent={partiallyTransparent}
        {...omitUndefined({ fontColor: props.data.attributes.fontColor })}
        alignCenter={props.data.attributes.alignCenter ?? DEFAULT}
        {...omitUndefined({ backgroundColor: props.data.attributes.backgroundColor })}
        {...omitUndefined({ backgroundRepeatX: props.data.attributes.backgroundRepeatX })}
        alignBottom={props.data.attributes.alignBottom}
      />
    </BreakFromCentered>
  )
}

export default withErrorBoundary(HeroSectionBlock)
