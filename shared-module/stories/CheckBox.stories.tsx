/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import CheckBox from "../src/components/InputFields/CheckBox"

export default {
  title: "Components/CheckBox",
  component: CheckBox,
} as Meta

const Component = CheckBox

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Check: Story<ComponentProps> = Template.bind({})
Check.args = {
  label: "Field Label",
  error: false,
  checked: true,
}
