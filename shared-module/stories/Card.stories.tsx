/* eslint-disable i18next/no-literal-string */
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
  chapterNumber: 1,
}
export const Course: Story<ComponentProps> = Template.bind({})
Course.args = {
  children: "Card",
  variant: "course",
  title: "Introduction to the role of AI",
  description:
    "MOOC center is responsible for creating custom online courses for univeristy of Helsinki.",
}
