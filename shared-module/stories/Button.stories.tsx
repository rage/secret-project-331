import React from "react"
import Button from "../src/components/Button"
import { Story, Meta } from "@storybook/react"

export default {
  title: "Components/Button",
  component: Button,
} as Meta

const Component = Button

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Primary: Story<ComponentProps> = Template.bind({})
Primary.args = {
  children: "Button",
  variant: "primary",
}

export const Secondary: Story<ComponentProps> = Template.bind({})
Secondary.args = {
  children: "Button",
  variant: "secondary",
}
