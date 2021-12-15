/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import SelectField from "../src/components/InputFields/SelectField"

export default {
  title: "Components/SelectField",
  component: SelectField,
} as Meta

const Component = SelectField

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Select: Story<ComponentProps> = Template.bind({})
Select.args = {
  name: "Select",
  label: "Field Label",
}
