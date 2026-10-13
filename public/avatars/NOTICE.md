# ToonLab sample avatars

All sample avatars are downloaded at build time from the TalkingHead upstream
repository at the pinned commit below and are served same-origin by ToonLab.

Pinned upstream commit:
`2afe6d79779313db8909badebf46f9805a6c7b70`

Source repository:
https://github.com/met4citizen/TalkingHead/tree/2afe6d79779313db8909badebf46f9805a6c7b70

Upstream licensing notes:
https://github.com/met4citizen/TalkingHead/blob/2afe6d79779313db8909badebf46f9805a6c7b70/README.md

## Included examples

- `mpfb.glb` → ToonLab `MPFB`
  - Created with Blender + MPFB.
  - Upstream lists this example as CC0.
  - https://creativecommons.org/publicdomain/zero/1.0/

- `brunette.glb` → ToonLab `Ready Player Me`
  - Created with Ready Player Me.
  - Upstream lists this example as CC BY-NC 4.0 / non-commercial use.

- `avaturn.glb` → ToonLab `Avaturn`
  - Created with Avaturn.
  - Upstream lists this example for non-commercial use.

- `avatarsdk.glb` → ToonLab `AvatarSDK`
  - Created with AvatarSDK / MetaPerson.
  - Upstream lists this example for non-commercial use.

- `vroid.glb` → ToonLab `VRoid`
  - Created with VRoid Studio.
  - Upstream lists this example for non-commercial use.

`brunette-t.glb` is not exposed as a separate ToonLab character because it is
the same Ready Player Me example in a different reference pose.

The MPFB GLB exceeds Cloudflare Workers' per-file static-asset limit, so ToonLab
splits it into glTF JSON, geometry and texture files at build time without
removing geometry, skeleton or morph targets. The other pinned sample GLBs are
served intact because each is below the per-file limit.

These avatar licenses are separate from ToonLab's MIT-licensed source code.
Before any commercial deployment, re-check the current terms from the original
avatar providers and replace non-commercial example assets if necessary.
