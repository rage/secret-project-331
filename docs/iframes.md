# IFrames

IFrames are used to bring specialized parts of user interfaces from exercise specific microservices to the more generic services. All communication with the IFrames is done with a MessageChannel (https://developer.mozilla.org/en-US/docs/Web/API/MessageChannel) between the parent document and the IFrame.

When the IFrame starts up, it gets the MessagePort for sending messages to the MessageChannel using the following process:

![Image of how IFrame gets the message port](./img/iframe-getting-port.plantuml.svg)

## Messages in the message channel

### height-changed

from: IFrame

to: parent

IFrame tells the parent its new height so that the parent can resize the IFrame.

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

to: IFrame

Parent posts the current saved state to the IFrame. Upon receiving this message, the IFrame is supposed to discard its existing internal state and start using the received state. The data can be anything -- the format is up to the exercise service.

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

from: IFrame

to: parent

IFrame posts its updated state. The IFrame is supposed to post this message whenever its internal state changes. The data posted will contain one of the following things depending on the use case:

- Private spec. This can be anything that defines the exercise. This gets saved and will be passed to the exercise service when loading the editor again and when grading a submission.
- Public spec. Specification that hides the correct answer that will be used to render an exercise to the student when they start doing the exercise. This will not be passed back to the editor when loading it again because the exercise service is supposed to be able to derive this again from the private spec.

The data is also accompanied by a validity status that indicates whether it should be able to be stored in its current form.

Example 1:

```js
{
  message: "current-state",
  data: [{ name: "yes", correct: true }, { name: "no", correct: false }],
  valid: true
}
```

Example 2:

```js
{
  message: "current-state",
  data: { password: "dasdasd9" },
  valid: true
}
```
