import React, { useContext } from "react"

import { BlockRendererProps } from ".."
import PageContext from "../../../contexts/PageContext"
import BreakFromCentered from "../../../shared-module/components/Centering/BreakFromCentered"
import HeroSection, { HeroSectionProps } from "../../../shared-module/components/HeroSection"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"

const HeroSectionBlock: React.FC<React.PropsWithChildren<BlockRendererProps<HeroSectionProps>>> = (
  props,
) => {
  const DEFAULT = true
  const pageData = useContext(PageContext)?.pageData
  const path = pageData?.url_path
  const formattedPath = path?.replace("-", " ").replace("/", "")
  const useDefaultTextForLabel = props.data.attributes.useDefaultTextForLabel ?? DEFAULT
  const isChapterFrontpage = pageData?.chapter_id
  const partiallyTransparent = props.data.attributes.partiallyTransparent ?? DEFAULT

  const chapterNumber =
    useDefaultTextForLabel && formattedPath && isChapterFrontpage
      ? formattedPath
      : props.data.attributes.label

  function parseInput(input: string) {
    const doc = new DOMParser().parseFromString(input, "text/html")
    return doc.documentElement.textContent?.toString() ?? ""
  }

  return (
    <BreakFromCentered sidebar={false}>
      <HeroSection
        label={chapterNumber}
        title={parseInput(props.data.attributes.title)}
        subtitle={parseInput(props.data.attributes.subtitle)}
        backgroundImage={props.data.attributes.backgroundImage}
        partiallyTransparent={partiallyTransparent}
        fontColor={props.data.attributes.fontColor}
        alignCenter={props.data.attributes.alignCenter ?? DEFAULT}
        backgroundColor={props.data.attributes.backgroundColor}
        backgroundRepeatX={props.data.attributes.backgroundRepeatX}
      />
    </BreakFromCentered>
  )
}

export default withErrorBoundary(HeroSectionBlock)
