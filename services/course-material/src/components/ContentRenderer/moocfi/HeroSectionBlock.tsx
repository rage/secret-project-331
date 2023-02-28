import React, { useContext } from "react"

import { BlockRendererProps } from ".."
import PageContext from "../../../contexts/PageContext"
import BreakFromCentered from "../../../shared-module/components/Centering/BreakFromCentered"
import HeroSection, { HeroSectionProps } from "../../../shared-module/components/HeroSection"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"

const HeroSectionBlock: React.FC<React.PropsWithChildren<BlockRendererProps<HeroSectionProps>>> = (
  props,
) => {
  const pageContext = useContext(PageContext)
  const path = pageContext?.pageData?.url_path
  const formattedPath = path?.replace("-", " ").replace("/", "")

  const chapterNumber =
    props.data.attributes?.includeChapterNumber && formattedPath
      ? formattedPath
      : props.data.attributes.chapter

  return (
    <BreakFromCentered sidebar={false}>
      <HeroSection
        chapter={chapterNumber}
        title={props.data.attributes.title}
        subtitle={props.data.attributes.subtitle}
        backgroundImage={props.data.attributes.backgroundImage}
        fontColor={props.data.attributes.fontColor}
        alignCenter={props.data.attributes.alignCenter}
        backgroundColor={props.data.attributes.backgroundColor}
      />
    </BreakFromCentered>
  )
}

export default withErrorBoundary(HeroSectionBlock)
