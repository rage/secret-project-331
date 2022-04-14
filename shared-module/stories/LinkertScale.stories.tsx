/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import LinkertScale from "../src/components/PeerReview/LinkertScale"

export default {
  title: "Components/PeerReview/LinkertScale",
  component: LinkertScale,
} as Meta

const Component = LinkertScale

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Primary: Story<ComponentProps> = Template.bind({})
Primary.args = {
  children: "LinkertScale",
}
