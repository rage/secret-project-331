/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import Timeline from "../src/components/Timeline"

export default {
  title: "Components/Timeline",
  component: Timeline,
} as Meta

const Component = Timeline

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Primary: Story<ComponentProps> = Template.bind({})
Primary.args = {
  children: "Timeline",
}
