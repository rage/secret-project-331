/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import TimePickerField from "../src/components/InputFields/TimePickerField"

export default {
  title: "Components/TimePickerField",
  component: TimePickerField,
} as Meta

const Component = TimePickerField

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Time: Story<ComponentProps> = Template.bind({})
Time.args = {
  label: "Field Label",
}
