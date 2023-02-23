import React from "react"

import { BlockRendererProps } from ".."
import BreakFromCentered from "../../../shared-module/components/Centering/BreakFromCentered"
import HeroSection, { HeroSectionProps } from "../../../shared-module/components/HeroSection"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"

const HeroSectionBlock: React.FC<React.PropsWithChildren<BlockRendererProps<HeroSectionProps>>> = (
  props,
) => {
  console.log({ props })
  return (
    <BreakFromCentered sidebar={false}>
      <HeroSection
        chapter={props.data.attributes.chapter}
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
