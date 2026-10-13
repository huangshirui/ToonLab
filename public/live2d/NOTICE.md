# ToonLab Live2D experiment notices

ToonLab's source code remains MIT licensed. The Live2D runtime and sample character assets used by the Live2D experiment have separate licenses and are not covered by ToonLab's MIT license.

## Cubism Core

Cubism Core is proprietary Live2D software and is **not copied into this public repository**. The sandboxed Live2D renderer loads the official hosting build at runtime:

https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js

Live2D Cubism SDK for Web download / hosting page:
https://www.live2d.com/en/sdk/download/web/

Live2D Proprietary Software License Agreement:
https://www.live2d.com/eula/live2d-proprietary-software-license-agreement_en.html

## Web renderer libraries

The sandboxed renderer uses pinned browser builds of:

- PixiJS 6.5.10 (MIT)
- pixi-live2d-display 0.4.0 (MIT)

They execute only inside an iframe sandboxed without `allow-same-origin`; the frame cannot read ToonLab's parent-page `localStorage` or OpenRouter credential.

## Live2D sample characters

The experiment references official sample assets directly from the Live2D/CubismWebSamples repository at pinned commit:

`b1de66b0b1f1cb881d95fb6158622aeb6a2827bd`

Included in the ToonLab character picker:

- Hiyori (`Samples/Resources/Hiyori`)
- Wanko (`Samples/Resources/Wanko`)

Live2D lists these sample resources under its Free Material License. Their artwork, model data, character rights and related assets are not MIT licensed.

Upstream license notice:
https://github.com/Live2D/CubismWebSamples/blob/b1de66b0b1f1cb881d95fb6158622aeb6a2827bd/LICENSE.md

Free Material License Agreement:
https://www.live2d.com/eula/live2d-free-material-license-agreement_en.html

Terms of Use for Live2D Cubism Sample Data:
https://www.live2d.com/eula/live2d-sample-model-terms_en.html
