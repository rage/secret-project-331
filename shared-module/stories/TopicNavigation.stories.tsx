/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import TopicNavigation from "../src/components/TopicNavigation"

export default {
  title: "Components/TopicNavigation",
  component: TopicNavigation,
} as Meta

const Component = TopicNavigation

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Primary: Story<ComponentProps> = Template.bind({})
Primary.args = {
  label: "Field Label",
}
