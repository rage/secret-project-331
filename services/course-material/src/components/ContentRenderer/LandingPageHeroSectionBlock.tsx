import React from "react"

import LandingPageHeroSection, {
  LandingPageHeroSectionProps,
} from "../../shared-module/components/LandingPageHeroSection"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"

import DefaultBlock from "./DefaultBlock"

import { BlockRendererProps, blockToRendererMap } from "."

const LandingPageHeroSectionBlock: React.FC<BlockRendererProps<LandingPageHeroSectionProps>> = (
  props,
) => {
  return (
    <LandingPageHeroSection title={props.data.attributes.title}>
      {props.data.innerBlocks.map((block) => {
        const Component = blockToRendererMap[block.name] ?? DefaultBlock
        return <Component key={block.clientId} data={block} />
      })}
    </LandingPageHeroSection>
  )
}

export default withErrorBoundary(LandingPageHeroSectionBlock)
