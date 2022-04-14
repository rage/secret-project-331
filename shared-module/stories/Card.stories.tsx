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
  bg: "#065853",
  chapterNumber: 1,
}
export const IllustrationCard: Story<ComponentProps> = Template.bind({})
IllustrationCard.args = {
  variant: "illustration",
  title: "Introduction to the role of AI",
  bg: "#065853",
  chapterNumber: 1,
  open: true,
  backgroundImage:
    "http://project-331.local/api/v0/files/course/1e0c52c7-8cb9-4089-b1c3-c24fc0dd5ae4/images/xblEKRBdiD5b5PVizOnxvw8X7qzrJD.svg",
}
