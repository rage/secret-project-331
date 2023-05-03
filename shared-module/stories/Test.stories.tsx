/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import CircularProgressBar from "../src/components/CircularProgressBar"

export default {
  title: "Components/CircularProgressBarTest",
  component: CircularProgressBar,
} as Meta

const Component = CircularProgressBar

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Simple: Story<ComponentProps> = Template.bind({})
Simple.args = {
  children: "CircularProgressBar",
}
