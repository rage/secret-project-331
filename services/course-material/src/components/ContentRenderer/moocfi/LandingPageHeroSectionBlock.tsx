import React, { useMemo } from "react"

import ContentRenderer, { BlockRendererProps } from ".."
import LandingPageHeroSection, { LandingPageHeroSectionProps } from "../../LandingPageHeroSection"

import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const LandingPageHeroSectionBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<LandingPageHeroSectionProps>>
> = (props) => {
  // We allow only one block as a inner block and it cannot have too much text
  const filteredInnerBlocks = useMemo(() => {
    const firstBlock = props.data.innerBlocks[0]
    // Disallow too long text
    if (
      firstBlock.attributes &&
      typeof firstBlock.attributes === "object" &&
      "content" in firstBlock.attributes &&
      typeof firstBlock.attributes.content === "string"
    ) {
      let content = firstBlock.attributes.content as string
      if (content.length > 300) {
        content = content.slice(0, 300) + "..."
      }
      // Remove all newlines
      content = content.replace(/\n/g, " ")
      firstBlock.attributes.content = content
    }

    return [firstBlock]
  }, [props.data.innerBlocks])
  return (
    <BreakFromCentered sidebar={false}>
      <LandingPageHeroSection
        title={props.data.attributes.title}
        backgroundImage={props.data.attributes.backgroundImage}
        backgroundColor={props.data.attributes.backgroundColor}
        fontColor={props.data.attributes.fontColor}
        backgroundRepeatX={props.data.attributes.backgroundRepeatX}
      >
        <ContentRenderer data={filteredInnerBlocks} isExam={false} />
      </LandingPageHeroSection>
    </BreakFromCentered>
  )
}

export default withErrorBoundary(LandingPageHeroSectionBlock)
