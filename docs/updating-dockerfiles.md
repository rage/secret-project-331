# Testing changes to Dockerfiles locally

1. Make changes to the Dockerfile

2. Build the image (you can use `bin` scripts like `bin/build-dockerfile-development-base`)

3. Load the image to minikube with `minikube image load ${tag}`, for example `minikube image load eu.gcr.io/moocfi-public/project-331-headless-lms-dev-base` (this might take a minute or two)

4. Remove the image that corresponds to the correct deployment with `minikube image rm ${tag}`. For example if you've edited an image that is part of `headless-lms`, run `minikube image rm headless-lms`. You can double-check with `minikube image ls` to make sure the image is gone. If you get an error about a container using the image, make sure `bin/dev` isn't running, wait a little and try again. The container might still be winding down.

5. When you next run `bin/dev`, you should see something like

```
Checking cache...
 - headless-lms: Not found. Building
```

in the output.

# Undoing the changes made above

1. Repeat the steps above, except instead of loading the image with `load`, unload it with `rm`: `minikube image rm ${tag}`, for example `minikube image rm eu.gcr.io/moocfi-public/project-331-headless-lms-dev-base`
