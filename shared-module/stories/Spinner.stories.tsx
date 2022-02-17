/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import Spinner from "../src/components/Spinner"

export default {
  title: "Components/Spinner",
  component: Spinner,
} as Meta

const Component = Spinner

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Primary: Story<ComponentProps> = Template.bind({})
Primary.args = {
  variant: "medium",
}
