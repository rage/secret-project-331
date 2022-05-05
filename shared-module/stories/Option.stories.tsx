/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import Option from "../src/components/PeerReview/Option"

export default {
  title: "Components/PeerReview/Option",
  component: Option,
} as Meta

const Component = Option

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Primary: Story<ComponentProps> = Template.bind({})
Primary.args = {
  children: "Option",
}
