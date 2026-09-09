MEMEFLOW OPEN POSITION ICON GEOMETRY V93
========================================

CONFIRMED ROOT CAUSE
--------------------
The info icon is implemented as a native <button class="position-info-v85">.

V85 visually requests:
  16px desktop
  14px <= 430px

But the site's global accessibility layer has:

  @media (pointer: coarse) {
    body.mf-accessibility-v64a :where(button, ...) {
      min-block-size: 44px;
    }
  }

On iPhone, pointer:coarse matches.

Therefore the icon SVG LOOKS 14px, but the BUTTON'S ACTUAL LAYOUT BOX
is forced to at least 44px tall.

That makes .position-bottomline about 44px tall. Inside the fixed 64px row
(with 8px top + 8px bottom padding), the title + gap + 44px bottom line do
not fit. The token name is pushed upward.

This exactly matches the user's observation that the bug started when the
info icon was added.

WHY V90/V91/V92 DID NOT SOLVE IT
--------------------------------
Those patches rearranged .position-main but did not remove the hidden 44px
minimum height on the info button. They were treating the symptom.

V93 FIX
-------
1. Fix the source in open-position-popover-v85.css:
   - info button block-size/min-block-size/max-block-size = 16px
   - on <=430px = 14px
   - only for this exact info button on coarse pointers

2. Remove V90/V91/V92 alignment layers from trading.html.
   Base trading.css layout is restored.

3. Keep V89 unchanged:
   Candidates = 64px
   Open positions = 64px
   Recent trades = 64px

4. Cache-bust the modified V85 CSS.

No JS/trading/data/RPC changes.

Install
-------
  unzip -o memeflow-open-position-icon-geometry-v93.zip
  bash memeflow-open-position-icon-geometry-v93/install.sh

Rollback
--------
  bash memeflow-open-position-icon-geometry-v93/rollback.sh
