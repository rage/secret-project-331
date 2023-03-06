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
  const path = useContext(PageContext)?.pageData?.url_path
  const formattedPath = path?.replace("-", " ").replace("/", "")
  const useDefaultTextForLabel = props.data.attributes.useDefaultTextForLabel ?? DEFAULT

  const chapterNumber =
    useDefaultTextForLabel && formattedPath ? formattedPath : props.data.attributes.label

  return (
    <BreakFromCentered sidebar={false}>
      <HeroSection
        label={chapterNumber}
        title={props.data.attributes.title}
        subtitle={props.data.attributes.subtitle}
        backgroundImage={props.data.attributes.backgroundImage}
        fontColor={props.data.attributes.fontColor}
        alignCenter={props.data.attributes.alignCenter ?? DEFAULT}
        backgroundColor={props.data.attributes.backgroundColor}
      />
    </BreakFromCentered>
  )
}

export default withErrorBoundary(HeroSectionBlock)
