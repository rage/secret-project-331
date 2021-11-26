/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import RadioButton from "../src/components/InputFields/RadioButton"

export default {
  title: "Components/RadioButton",
  component: RadioButton,
} as Meta

const Component = RadioButton

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Radio: Story<ComponentProps> = Template.bind({})
Radio.args = {
  label: "Field Label",
  checked: true,
}
