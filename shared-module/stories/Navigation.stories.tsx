/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import Navigation from "../src/components/Navigation/index"

export default {
  title: "Components/Navigation/Nav",
  component: Navigation,
} as Meta

const Component = Navigation

type ComponentProps = React.ComponentProps<typeof Navigation>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Simple: Story<ComponentProps> = Template.bind({})
Simple.args = {
  children: "Navigation",
  variant: "simple",
}

export const Complex: Story<ComponentProps> = Template.bind({})
Complex.args = {
  children: "Navigation",
  variant: "complex",
}
export const Breadcrumbs: Story<ComponentProps> = Template.bind({})
Breadcrumbs.args = {
  children: "Navigation",
  variant: "breadcrumbs",
}
