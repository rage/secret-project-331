/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import InstructionBox from "../src/components/InstructionBox"

export default {
  title: "Components/InstructionBox",
  component: InstructionBox,
} as Meta

const Component = InstructionBox

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Primary: Story<ComponentProps> = Template.bind({})
Primary.args = {
  children: "InstructionBox",
}
