/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import GenericInfobox from "../src/components/GenericInfobox"

export default {
  title: "Components/GenericInfobox",
  component: GenericInfobox,
} as Meta

const Component = GenericInfobox

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Primary: Story<ComponentProps> = Template.bind({})
Primary.args = {
  children: <div>Important information</div>,
}
