/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import Congratulation from "../src/components/Congratulation"

export default {
  title: "Components/Congratulation",
  component: Congratulation,
} as Meta

const Component = Congratulation

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Primary: Story<ComponentProps> = Template.bind({})
Primary.args = {
  children: "Congratulation",
}
