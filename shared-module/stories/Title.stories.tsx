import { Meta, Story } from "@storybook/react"
import React from "react"

import Title from "../src/components/Title"

export default {
  title: "Components/Title",
  component: Title,
} as Meta

const Component = Title

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Large: Story<ComponentProps> = Template.bind({})
Large.args = {
  children: "Title",
  variant: "large",
}

export const Medium: Story<ComponentProps> = Template.bind({})
Medium.args = {
  children: "Title",
  variant: "medium",
}

export const Small: Story<ComponentProps> = Template.bind({})
Small.args = {
  children: "Title",
  variant: "small",
}
