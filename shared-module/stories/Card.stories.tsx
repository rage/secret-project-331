import { Meta, Story } from "@storybook/react"
import React from "react"

import Card from "../src/components/Card"

export default {
  title: "Components/Card",
  component: Card,
} as Meta

const Component = Card

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Simple: Story<ComponentProps> = Template.bind({})
Simple.args = {
  children: "Card",
  variant: "simple",
  title: "Introduction to the role of AI",
  chapter: "1",
}
