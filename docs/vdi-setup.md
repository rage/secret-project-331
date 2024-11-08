# VDI Setup for MOOC Center Employees

> **Note**: This guide is intended **exclusively for employees of the MOOC Center at the University of Helsinki** who need to set up a Virtual Desktop Infrastructure (VDI) environment for working on Secret Project 331.

This document details the setup process for the VDI environment specifically required for development on Secret Project 331.

## Ordering a VDI Desktop

1. Go to [https://onify.it.helsinki.fi/](https://onify.it.helsinki.fi/) and select **Order a virtual desktop**.
2. Choose **Basic Linux** as the desktop type.
3. Enter your university username as the name for the virtual desktop.
4. For the WBS number, please ask **redande** or **hn** in the MOOC Center Slack channel.
5. To receive sufficient resources and an external disk necessary for development, contact the university's helpdesk. The MOOC Center has an ongoing email thread for these requests; ask **redande** or **hn** to add your request to this thread.

## Install and Set Up VMware Horizon Client

1. If VMware Horizon Client is not already installed, download it from [VMware Horizon Client Downloads](https://customerconnect.vmware.com/en/downloads/info/slug/desktop_end_user_computing/vmware_horizon_clients/horizon_8).
2. Install the client software on your machine.
3. Open VMware Horizon Client and select **New Server**.
4. Enter `vdi.helsinki.fi` as the **Connection Server**.
5. Sign in with your university credentials. Make sure the dropdown below the credentials field is set to **ATKK**.
6. Select your virtual desktop, which should appear as `vdi-<your university username>`.

> **Tip**: You can also access the virtual desktop through [https://vdi.helsinki.fi](https://vdi.helsinki.fi), but using the VMware Horizon Client is recommended for better performance and features.

## Requesting Administrative Privileges (sudo)

Since many development tools require administrative privileges, follow these steps to request `sudo` rights:

1. Complete [this form](https://elomake.helsinki.fi/lomakkeet/42471/lomake.html) to request administrative rights.
2. For the **Identification of workstation** field, enter the name of your virtual desktop (e.g., `vdi-<your university username>`).
3. In the **Reason** field, state that you need administrative privileges to develop MOOC Center software.

## Setting Up Secret Project 331 on the Virtual Desktop

### Git and GitHub Setup

Git should already be installed on the VDI. Confirm this by running `git --version`. If it's not installed, install it with "sudo apt install git".

1. Configure your Git identity:

   ```bash
   git config --global user.name "Your Name"
   git config --global user.email "youremail@example.com"
   ```

   > **Privacy Tip**: If you'd like to keep your email private, follow [GitHub's guide to using a `noreply` email address](https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-personal-account-on-github/managing-email-preferences/setting-your-commit-email-address).

2. **(Optional)** Install GitHub CLI to cache credentials and avoid entering your personal access token repeatedly:

   ```bash
   type -p curl >/dev/null || (sudo apt update && sudo apt install curl -y)
   curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
   && sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
   && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
   && sudo apt update \
   && sudo apt install gh -y
   ```

3. Authenticate with GitHub CLI to cache credentials:
   ```bash
   gh auth login
   ```
   - Select **HTTPS** as the protocol.
   - If logging in via browser, install Firefox if needed: `snap install firefox`.

### Project Space Setup

1. Clone the repository using HTTPS:

   ```bash
   git clone https://github.com/rage/secret-project-331.git
   ```

2. Run the `vdi-setup` script to install required dependencies and set up the project in your `/data` drive:

   ```bash
   cd secret-project-331
   sudo bin/vdi-setup
   ```

3. Apply any environment variable changes:

   ```bash
   source "$HOME/.profile"
   ```

   > **Note**: If this command does not work, try running it in a Bash shell instead of Fish. Enter Bash by typing `bash`, run the command, then exit Bash with `Ctrl+D`.

4. Install the latest version of Node.js:

   ```bash
   nvm install lts
   ```

5. Apply Docker group permissions:

   ```bash
   newgrp docker
   ```

6. Install required tools by running:

   ```bash
   bin/download-applications-linux
   ```

7. Restart your terminal to apply all changes.

8. Delete the initially cloned repository if you no longer need it and use the one located in `/data`.

### Running the Development Environment

1. Navigate to the project directory:

   ```bash
   cd /data/username/Code/secret-project-331
   ```

2. Follow the instructions in the `docs/Development.md` file under the section **Running the development environment** to complete the setup.

> **Tip**: The `vdi-setup` script installs most dependencies, so you may skip parts of the setup process in `Development.md`.
