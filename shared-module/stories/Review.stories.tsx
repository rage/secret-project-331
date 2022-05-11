/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import Review from "../src/components/PeerReview/Review"

export default {
  title: "Components/PeerReview/Review",
  component: Review,
} as Meta

const Component = Review

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Primary: Story<ComponentProps> = Template.bind({})
Primary.args = {
  children: "Option",
}
