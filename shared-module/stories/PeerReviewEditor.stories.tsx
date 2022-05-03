/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import PeerReviewEditor from "../src/components/PeerReviewEditor"

export default {
  title: "Components/PeerReviewEditor",
  component: PeerReviewEditor,
} as Meta

const Component = PeerReviewEditor

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Primary: Story<ComponentProps> = Template.bind({})
Primary.args = {
  children: "PeerReviewEditor",
}
