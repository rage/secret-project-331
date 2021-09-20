# -*- mode: ruby -*-
# vi: set ft=ruby :

# All Vagrant configuration is done below. The "2" in Vagrant.configure
# configures the configuration version (we support older styles for
# backwards compatibility). Please don't change it unless you know what
# you're doing.
Vagrant.configure("2") do |config|
  # The most common configuration options are documented and commented below.
  # For a complete reference, please see the online documentation at
  # https://docs.vagrantup.com.

  # Every Vagrant development environment requires a box. You can search for
  # boxes at https://vagrantcloud.com/search.
  config.vm.box = "archlinux/archlinux"

  # Disable automatic box update checking. If you disable this, then
  # boxes will only be checked for updates when the user runs
  # `vagrant box outdated`. This is not recommended.
  # config.vm.box_check_update = false

  # Create a forwarded port mapping which allows access to a specific port
  # within the machine from a port on the host machine. In the example below,
  # accessing "localhost:8080" will access port 80 on the guest machine.
  # NOTE: This will enable public access to the opened port
  # config.vm.network "forwarded_port", guest: 80, host: 8080

  # Create a forwarded port mapping which allows access to a specific port
  # within the machine from a port on the host machine and only allow access
  # via 127.0.0.1 to disable public access
  # config.vm.network "forwarded_port", guest: 80, host: 8080, host_ip: "127.0.0.1"

  # Create a private network, which allows host-only access to the machine
  # using a specific IP.
  # config.vm.network "private_network", ip: "192.168.33.10"

  # Create a public network, which generally matched to bridged network.
  # Bridged networks make the machine appear as another physical device on
  # your network.
  config.vm.network "private_network", ip: "55.55.55.5"

  # Share an additional folder to the guest VM. The first argument is
  # the path on the host to the actual folder. The second argument is
  # the path on the guest to mount the folder. And the optional third
  # argument is a set of non-required options.
  # config.vm.synced_folder "../data", "/vagrant_data"

  # Provider-specific configuration so you can fine-tune various
  # backing providers for Vagrant. These expose provider-specific options.
  # Example for VirtualBox:
  #
  config.vm.provider "virtualbox" do |vb|
    # Display the VirtualBox GUI when booting the machine
    # vb.gui = true

    # Customize the amount of memory on the VM:
    vb.memory = "16096"
    vb.cpus = 8
  end
  #
  # View the documentation for the provider you are using for more
  # information on available options.

  # Enable provisioning with a shell script. Additional provisioners such as
  # Ansible, Chef, Docker, Puppet and Salt are also available. Please see the
  # documentation for more information about their specific syntax and use.
  config.vm.provision "shell", privileged: false, inline: <<-SHELL
    sudo pacman -Syu --noconfirm
    sudo pacman -S --noconfirm --needed base-devel skaffold kubernetes-tools minikube kustomize docker postgresql sudo patch fakeroot git htop
    sudo systemctl enable docker
    sudo usermod -a -G docker vagrant
    # nvm
    mkdir -p aur-build
    cd aur-build
    git clone https://aur.archlinux.org/nvm.git
    cd nvm
    # Commit hash verified to be safe. If you update this, verify the files in the commit so that we don't accidentally execute malicious code code.
    git checkout 98091c0759162b1032722896d7443530151ab9c8
    makepkg --syncdeps --install --noconfirm
    echo 'source /usr/share/nvm/init-nvm.sh' >> ~/.bashrc
    cd ../../
    rm -rf aur-build
    # install lts node
    source /usr/share/nvm/init-nvm.sh
    nvm install --lts
    # Loading this kernel module gives better docker performance
    echo "overlay" | sudo tee /etc/modules-load.d/overlay.conf
    sudo mkdir -p /etc/docker
    echo "{\"storage-driver\": \"overlay2\"}" | sudo tee /etc/docker/daemon.json
    reboot
  SHELL
end
