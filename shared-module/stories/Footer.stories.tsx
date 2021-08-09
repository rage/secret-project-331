import { Meta, Story } from "@storybook/react"
import React from "react"

import Footer from "../src/components/Footer"

export default {
  title: "Components/Footer",
  component: Footer,
} as Meta

const Component = Footer

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Primary: Story<ComponentProps> = Template.bind({})
Primary.args = {}
