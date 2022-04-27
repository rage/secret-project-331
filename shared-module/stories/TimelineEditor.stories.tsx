/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import TimelineEditor from "../src/components/TimelineEditor"

export default {
  title: "Components/TimelineEditor",
  component: TimelineEditor,
} as Meta

const Component = TimelineEditor

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Primary: Story<ComponentProps> = Template.bind({})
Primary.args = {
  children: "TimelineEditor",
}
