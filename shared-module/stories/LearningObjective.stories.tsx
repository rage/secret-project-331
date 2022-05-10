/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import LearningObjective from "../src/components/LearningObjectiveSection"

const PLACEHOLDER_TEXT = "The passage experienced a surge in popularity during the 1960s."

const objectives = [PLACEHOLDER_TEXT, PLACEHOLDER_TEXT, PLACEHOLDER_TEXT, PLACEHOLDER_TEXT]

export default {
  title: "Components/LearningObjective",
  component: LearningObjective,
} as Meta

const Component = LearningObjective

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => (
  <>
    <Component {...args} objectives={objectives} />
  </>
)

export const Primary: Story<ComponentProps> = Template.bind({})
Primary.args = {
  title: "I am here",
  children: "LearningObjective",
}
