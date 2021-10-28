/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import Accordion from "../src/components/Accordion/index"

export default {
  component: Accordion,
  title: "Components/Accordion",
} as Meta

/* export const SimpleAccordion: React.VFC<Record<string, unknown>> = () => <Accordion /> */

const Component = Accordion

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Simple: Story<ComponentProps> = Template.bind({})
Simple.args = {
  children: "Accordion",
  variant: "simple",
}

export const Detail: Story<ComponentProps> = Template.bind({})
Detail.args = {
  children: "Accordion",
  variant: "detail",
}
