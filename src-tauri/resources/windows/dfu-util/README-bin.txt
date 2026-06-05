dfu-util 0.11 binaries

The Windows binaries were built using MinGW on Ubuntu 20.04
and the instructions on http://dfu-util.sourceforge.net/build.html

The macOS (darwin) binaries were built on macOS 10.13.6

The Linux dfu-util-static has libusb statically linked.

The dfu-util source was from the 0.11 release tarball.

The libusb source was from latest git 2021-09-05 (pre-1.0.25)
commit v1.0.24-66-g1a90627

The lsusb utility was built from usbutils v014
with the patch lsusb_build_on_mingw.patch applied.
