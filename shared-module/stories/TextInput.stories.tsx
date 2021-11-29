/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import TextField from "../src/components/InputFields/TextField"

export default {
  title: "Components/TextField",
  component: TextField,
} as Meta

const Component = TextField

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Text: Story<ComponentProps> = Template.bind({})
Text.args = {
  type: "text",
  label: "Field Label",
  placeholder: "Name",
  error: true,
  required: true,
}
