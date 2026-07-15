"use client"

import React, { useMemo } from "react"

import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import { omitUndefined } from "@/shared-module/common/utils/nullability"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import type { BlockRendererProps } from ".."
import ContentRenderer from ".."
import type { LandingPageHeroSectionProps } from "../../LandingPageHeroSection"
import LandingPageHeroSection from "../../LandingPageHeroSection"

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
      content = content.replaceAll("\n", " ")

      copiedBlock.attributes = { ...copiedBlock.attributes, content }
    }

    return [copiedBlock]
  }, [props.data.innerBlocks])
  return (
    <BreakFromCentered sidebar={false}>
      <LandingPageHeroSection
        title={props.data.attributes.title}
        {...omitUndefined({ backgroundImage: props.data.attributes.backgroundImage })}
        {...omitUndefined({ backgroundColor: props.data.attributes.backgroundColor })}
        {...omitUndefined({ fontColor: props.data.attributes.fontColor })}
        {...omitUndefined({ backgroundRepeatX: props.data.attributes.backgroundRepeatX })}
      >
        <ContentRenderer data={filteredInnerBlocks} isExam={false} />
      </LandingPageHeroSection>
    </BreakFromCentered>
  )
}

export default withErrorBoundary(LandingPageHeroSectionBlock)
