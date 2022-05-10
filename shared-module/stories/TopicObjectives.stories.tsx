/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import TopicObjectives from "../src/components/TopicObjectives"

export default {
  title: "Components/TopicObjectives",
  component: TopicObjectives,
} as Meta

const Component = TopicObjectives

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Primary: Story<ComponentProps> = Template.bind({})
Primary.args = {
  children: "TopicObjectives",
}
