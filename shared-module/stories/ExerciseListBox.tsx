/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import ListCourseProgress from "../src/components/ExerciseList/ExerciseBox"

export default {
  title: "Components/ListCourseProgress",
  component: ListCourseProgress,
} as Meta

const Component = ListCourseProgress

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Simple: Story<ComponentProps> = Template.bind({})
Simple.args = {
  children: "ListCourseProgress",
}
