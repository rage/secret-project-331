/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import LikertScale from "../src/components/PeerReview/LikertScale"

export default {
  title: "Components/PeerReview/LikertScale",
  component: LikertScale,
} as Meta

const Component = LikertScale

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Primary: Story<ComponentProps> = Template.bind({})
Primary.args = {
  children: "LikertScale",
}
