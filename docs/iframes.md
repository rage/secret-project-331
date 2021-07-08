# Iframes

Iframes are used to bring specialized parts of user interfaces from exercise specific microservices to the more generic services. All communication with the iframes is done with a MessageChannel (https://developer.mozilla.org/en-US/docs/Web/API/MessageChannel) between the parent document and the Iframe.

When the Iframe starts up, it gets the MessagePort for sending messages to the MessageChannel using the following process:

![Image of how iframe gets the message port](./img/iframe-getting-port.plantuml.svg)

## Messages in the message channel

### height-changed

from: iframe

to: parent

Iframe tells the parent its new height so that the parent can resize the iframe.

Example 1:

```js
{
  message: "height-changed",
  data: 11
}
```

Example 2:

```js
{
  message: "height-changed",
  data: 25
}
```

### set-state

from: parent

to: iframe

Parent posts the current saved state to the iframe. Upon receiving this message, the iframe is supposed to discard its existing internal state and start using the received state. The data can be anything -- the format is up to the exercise service.

Example 1:

```js
{
  message: "set-state",
  data: [{ name: "yes", correct: true }, { name: "no", correct: false }]
}
```

Example 2:

```js
{
  message: "set-state",
  data: { password: "dasdasd9" }
}
```

### current-state

from: iframe

to: parent

Iframe posts its updated state. The iframe is supposed to post this message whenever its internal state changes. The data posted will contain the following things:

1. Private spec. This can be anything that defines the exercise. This gets saved and will be passed to the exercise service when loading the editor again and when grading a submission.
2. Public spec. Specification that hides the correct answer that will be used to render an exercise to the student when they start doing the exercise. This will not be passed back to the editor when loading it again because the exercise service is supposed to be able to derive this again from the private spec.

Example 1:

```js
{
  message: "current-state",
  data: {
    private_spec: [{ name: "yes", correct: true }, { name: "no", correct: false }],
    public_spec: [{ name: "yes" }, { name: "no" }]
  },
}
```

Example 2:

```js
{
  message: "current-state",
  data: {
    private_spec: { password: "dasdasd9" },
    public_spec: {}
  },
}
```
