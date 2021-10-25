import { Meta, Story } from "@storybook/react"
import React from "react"

import FloatingErrorBox from "../src/components/FloatingErrorBox"

export default {
  title: "Components/FloatingErrorBox",
  component: FloatingErrorBox,
} as Meta

const Component = FloatingErrorBox

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Primary: Story<ComponentProps> = Template.bind({})
Primary.args = {}
