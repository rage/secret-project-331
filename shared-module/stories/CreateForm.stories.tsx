/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import CreateAccountForm from "../src/components/CreateAccountForm"

export default {
  title: "Components/CreateAccountForm",
  component: CreateAccountForm,
} as Meta

const Component = CreateAccountForm

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Primary: Story<ComponentProps> = Template.bind({})
Primary.args = {
  children: "CreateAccountForm",
}
