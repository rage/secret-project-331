/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import DateTimeLocal from "../src/components/InputFields/DateTimeLocal"

export default {
  title: "Components/DateTimeLocal",
  component: DateTimeLocal,
} as Meta

const Component = DateTimeLocal

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const DateTime: Story<ComponentProps> = Template.bind({})
DateTime.args = {
  label: "Field Label",
}
