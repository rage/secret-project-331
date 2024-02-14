/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import DropdownMenu from "../src/components/DropdownMenu"

export default {
  title: "Components/DropdownMenu",
  component: DropdownMenu,
} as Meta

const Component = DropdownMenu

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Default: Story<ComponentProps> = Template.bind({})
Default.args = {
  items: [
    {
      label: "First option",
      onClick: () => {},
    },
    {
      label: "Second option",
      onClick: () => {},
    },
    { label: "Third option", href: "https://www.example.com" },
  ],
}
