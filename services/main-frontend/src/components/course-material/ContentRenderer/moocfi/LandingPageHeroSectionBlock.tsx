"use client"
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
    const firstBlock = props.data.innerBlocks?.[0]

    if (!firstBlock) {
      return []
    }

    const copiedBlock = { ...firstBlock }

    if (
      copiedBlock.attributes &&
      typeof copiedBlock.attributes === "object" &&
      "content" in copiedBlock.attributes &&
      typeof copiedBlock.attributes.content === "string"
    ) {
      let content = copiedBlock.attributes.content as string
      // Disallow too long text
      if (content.length > 300) {
        content = content.slice(0, 300) + "..."
      }
      // Remove all newlines
      content = content.replace(/\n/g, " ")

      copiedBlock.attributes = { ...copiedBlock.attributes, content }
    }

    return [copiedBlock]
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
