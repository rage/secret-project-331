/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import PeerReviewProgress from "../src/components/PeerReview/PeerReviewProgress"

export default {
  title: "Components/PeerReview/PeerReviewProgress",
  component: PeerReviewProgress,
} as Meta

const Component = PeerReviewProgress

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Primary: Story<ComponentProps> = Template.bind({})
Primary.args = {
  total: 10,
  attempt: 2,
  children: "Option",
}
