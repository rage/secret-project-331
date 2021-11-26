/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import DatePickerField from "../src/components/InputFields/DatePickerField"

export default {
  title: "Components/DatePickerField",
  component: DatePickerField,
} as Meta

const Component = DatePickerField

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Date: Story<ComponentProps> = Template.bind({})
Date.args = {
  label: "Field Label",
}
