{pkgs}: {
  deps = [
    pkgs.chromium
    pkgs.glibc
    pkgs.libxkbcommon
    pkgs.wayland
    pkgs.mesa
    pkgs.libdrm
    pkgs.at-spi2-atk
    pkgs.dbus
    pkgs.expat
    pkgs.alsa-lib
    pkgs.cairo
    pkgs.pango
    pkgs.xorg.libxcb
    pkgs.xorg.libXrandr
    pkgs.xorg.libXfixes
    pkgs.xorg.libXext
    pkgs.xorg.libXdamage
    pkgs.xorg.libXcomposite
    pkgs.xorg.libX11
    pkgs.cups
    pkgs.atk
    pkgs.nspr
    pkgs.nss
    pkgs.glib
  ];
}
