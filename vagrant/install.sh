sudo pacman -Syu --noconfirm
sudo pacman -S --noconfirm --needed base-devel skaffold kubernetes-tools minikube kustomize docker postgresql redis sudo patch fakeroot git htop duf nginx
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

# Configure NGINX
read -r -d '' NGINX_CONF <<- EOM
worker_processes  1;

events {
    worker_connections  1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;

    sendfile        on;
    keepalive_timeout  65;

    server {
        listen       80;
        server_name  localhost;

        location / {
            proxy_pass http://project-331.local;
        }

        error_page   500 502 503 504  /50x.html;
        location = /50x.html {
            root   /usr/share/nginx/html;
        }

    }
}
EOM
echo "$NGINX_CONF" | sudo tee /etc/nginx/nginx.conf

reboot
