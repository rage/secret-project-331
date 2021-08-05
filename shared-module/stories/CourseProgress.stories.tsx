import { Meta, Story } from "@storybook/react"
import React from "react"

import CourseProgress from "../src/components/CourseProgress/index"

export default {
  title: "Components/CourseProgress",
  component: CourseProgress,
} as Meta

const Component = CourseProgress

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const ProgressCircle: Story<ComponentProps> = Template.bind({})
ProgressCircle.args = {
  children: "CourseProgress",
  variant: "circle",
}

export const ProgressBar: Story<ComponentProps> = Template.bind({})
ProgressBar.args = {
  children: "CourseProgress",
  variant: "bar",
}
