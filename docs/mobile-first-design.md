# Mobile first design

## Idea

[Read the article](https://zellwk.com/blog/how-to-write-mobile-first-css/)

In summary mobile first design is to start the design process from the smallest device that people use, which is typically a mobile device, and gradually move to a bigger screen sizes.

## In practice

Use [respondToOrLarger](secret-project-331/shared-module/packages/common/src/styles/respond.ts) in your css. Its a helper tool to easily implement media-queries in to your css. **Always** first design how the component looks in a mobile viewport and inside media-query block implement the design if the screen gets bigger.

eg.

```js
<div
  className={css`
    display: flex;
    flex: 2;

    # In the mobile screen child components are stacked on top of each other for a better look.

    flex-direction: column;
    justify-content: space-between;
    ${respondToOrLarger.sm} {

      # When screen gets bigger than .sm child components are placed next to each other.

      flex-direction: row;
    }
  `}
>
```
