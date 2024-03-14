# VDI setup

## Ordering a VDI desktop

1. Go to [https://onify.it.helsinki.fi/](https://onify.it.helsinki.fi/) and select `Order a virtual desktop`.
2. Select `Basic Linux`.
3. To get proper resources and an external disk that is required for the environment setup, the university's helpdesk needs to be emailed about it. The MOOC-center has an email thread regarding this, so you can ask in the Rage Research-slack's #secret-project-331 channel for help to email to that thread to get the resources for your virtual desktop.

## Install and set up VMware Horizon Client

1. If you don't have the VMware Horizon Client (university computers should have it by default), download it from [here](https://customerconnect.vmware.com/en/downloads/info/slug/desktop_end_user_computing/vmware_horizon_clients/horizon_8).
2. Install the software.
3. Open VMware Horizon Client.
4. Double click the `New Server`-button.
5. Enter your university credentials. The dropdown below the credentials-fields should default to `ATKK`, but if it's something else, switch it to `ATKK`.
6. Select your virtual desktop, probably named `vdi-<your university username>` or `mooc-<your university username>`.

**NB!** You can also access the virtual desktop at [vdi.helsinki.fi](https://vdi.helsinki.fi) without installing the VMware Horizon Client, but this isn't recommended as the connection is a lot worse and the website-version has more limited features.

## Getting sudo

Fill this [form](https://elomake.helsinki.fi/lomakkeet/42471/lomake.html) to request admin rights to your virtual desktop. You can state as the reason for requesting administrative priviledges that developing MOOC-center's software is impossible without admin rights.

## Setting up secret project in the virtual desktop

### Setting up git and GitHub

git should be installed by default, you can check by running `git --version`. If it is missing for some reason, you can install git [here](https://git-scm.com/downloads).

Set your identity with

- `git config --global user.name "John Doe"`
- `git config --global user.email johndoe@example.com`

  - **NB!** If you'd like to keep your email private, see GitHub's guide [here](https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-personal-account-on-github/managing-email-preferences/setting-your-commit-email-address) on how to use a `noreply`-email address provided by GitHub.

- Optional: Install GitHub CLI for caching your credentials (so you don't have to enter your personal access token for every git command) by copy-pasting the following to your terminal:

```bash
type -p curl >/dev/null || (sudo apt update && sudo apt install curl -y)
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
&& sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
&& echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
&& sudo apt update \
&& sudo apt install gh -y
```

- Cache your credentials with GitHub CLI with `gh auth login`.
  - Follow the prompts, be sure to select HTTPS.
  - If you select login via browser, you need to install firefox with `snap install firefox`.

### Setting up the project space

1. Clone the repository with https (or ssh if you'd prefer, GitHub recommends https nowadays) with `git clone https://github.com/rage/secret-project-331.git`.

2. Run `sudo bin/vdi-setup` script from the repository to install the required dependencies and set up the repository in the /data -disk.

3. Run `source "$HOME/.profile"` to apply changes made to the PATH-variable.

- If you get an error here, try running the command in a bash shell instead of the fish shell. You can enter a bash shell by running the command `bash`, and after running the source-command you can exit back to the fish shell with ctrl+d.

4. Install the latest version of Node with `nvm install lts`.

5. Run `newgrp docker` to apply changes made to the group `docker`.

6. Run `bin/download-applications-linux` script to install the required tools.

7. Restart the terminal.

8. Delete the repository you manually cloned in step 1. It shouldn't be needed anymore, as you should use the repository that was cloned to /data with the vdi-setup -script during step 2.

### Setting up the development environment

1. Open a terminal and go to `/data/username/Code/secret-project-331`.

2. Install google cloud cli with `sudo snap install google-cloud-cli --classic` and then log into it with `gcloud auth login`.

3. Follow the instructions from the project's `doc/Development.md` to set up the environment.
   - **NB!** most of the tools and dependencies are already installed during setting up the project space, so you can skip ahead to the section _Running the development environment_
