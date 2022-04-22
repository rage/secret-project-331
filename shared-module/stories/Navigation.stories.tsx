/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import { NavBar } from "../src/components/Navigation/NavBar"

export default {
  title: "Components/NavBar/Nav",
  component: NavBar,
} as Meta

const Component = NavBar

type ComponentProps = React.ComponentProps<typeof NavBar>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Simple: Story<ComponentProps> = Template.bind({})
Simple.args = {
  children: "NavBar",
  variant: "simple",
}

export const Complex: Story<ComponentProps> = Template.bind({})
Complex.args = {
  children: "NavBar",
  variant: "complex",
}
