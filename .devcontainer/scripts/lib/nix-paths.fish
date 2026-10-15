if test -e /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.fish
    source /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.fish
end

if test -d /nix/var/nix/profiles/default/bin
    fish_add_path -m /nix/var/nix/profiles/default/bin
end

if test -d "$HOME/.nix-profile/bin"
    fish_add_path -m "$HOME/.nix-profile/bin"
end
