import React from "react"

import HeroSection, { HeroSectionProps } from "../../shared-module/components/HeroSection"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"

import { BlockRendererProps } from "."

const HeroSectionBlock: React.FC<BlockRendererProps<HeroSectionProps>> = (props) => {
  return (
    <HeroSection title={props.data.attributes.title} subTitle={props.data.attributes.subTitle} />
  )
}

export default withErrorBoundary(HeroSectionBlock)
