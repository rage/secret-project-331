import React from "react"

import { BlockRendererProps, blockToRendererMap } from ".."
import BreakFromCentered from "../../../shared-module/components/Centering/BreakFromCentered"
import LandingPageHeroSection, {
  LandingPageHeroSectionProps,
} from "../../../shared-module/components/LandingPageHeroSection"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"
import DefaultBlock from "../DefaultBlock"

const LandingPageHeroSectionBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<LandingPageHeroSectionProps>>
> = (props) => {
  return (
    <BreakFromCentered sidebar={false}>
      <LandingPageHeroSection
        title={props.data.attributes.title}
        backgroundImage={props.data.attributes.backgroundImage}
        backgroundColor={props.data.attributes.backgroundColor}
        backgroundRepeatX={props.data.attributes.backgroundRepeatX}
      >
        {props.data.innerBlocks.map((block) => {
          const Component = blockToRendererMap[block.name] ?? DefaultBlock
          return <Component key={block.clientId} data={block} />
        })}
      </LandingPageHeroSection>
    </BreakFromCentered>
  )
}

export default withErrorBoundary(LandingPageHeroSectionBlock)
