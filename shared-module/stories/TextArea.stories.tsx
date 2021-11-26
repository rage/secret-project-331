/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import TextAreaField from "../src/components/InputFields/TextAreaField"

export default {
  title: "Components/TextAreaField",
  component: TextAreaField,
} as Meta

const Component = TextAreaField

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const TextArea: Story<ComponentProps> = Template.bind({})
TextArea.args = {
  label: "Field Label",
}
