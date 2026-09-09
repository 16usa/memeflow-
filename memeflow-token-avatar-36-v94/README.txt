MEMEFLOW TOKEN AVATAR 36 V94
============================

Canonical size in Open positions / Candidates / Recent trades: 36x36px.

This patch removes the previous overlapping size chain:
- 42x42 base
- 46x46 mobile
- 29x29 V76
- 32x32 V76 mobile

It leaves only one 36px avatar size and one matching 36px Pump.fun wrapper size.
V89 64px row height stays unchanged.

On the current narrow-phone geometry:
- left edge: 9px
- top/bottom free space: 14px
- current 46px avatar column + 7px gap => 17px image-to-text

Install:
  unzip -o memeflow-token-avatar-36-v94.zip
  bash memeflow-token-avatar-36-v94/install.sh

Rollback:
  bash memeflow-token-avatar-36-v94/rollback.sh
