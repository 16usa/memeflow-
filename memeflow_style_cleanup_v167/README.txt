MEMEFLOW X CANONICAL CLEANUP V167

Purpose
-------
Remove the recent incremental visual layer stack (V162-V166) and replace it
with one canonical dark-style authority without changing the intended current
appearance.

Final dark style
----------------
Background / neutral surfaces: #000000
Primary text:                  #E7E9EA
Strong text:                   #FFFFFF
Secondary / metadata text:     #71767B
Tertiary text:                 #536471
Faint text:                    #3E4A55
Link / focus:                  #1D9BF0
Borders / dividers:            #2F3336, 1px
Neutral buttons:               #111111
Neutral hover:                 #171717
Primary CTA:                   #FFFFFF / #000000

Cleanup
-------
- deletes memeflow-pump-fee-palette-v162.css
- deletes memeflow-pump-fee-palette-v163.css
- deletes memeflow-pump-fee-full-ui-v164.css
- deletes memeflow-pure-black-v165.css
- deletes memeflow-x-lights-out-v166.css
- removes their HTML links
- removes old recent patch directories when present
- adds exactly one memeflow-x-canonical-v167.css link to each production page

Important
---------
Existing functional/layout CSS remains in place because it owns geometry,
responsive behavior, 3D layout and component functionality. V167 removes the
recent conflicting visual override stack, not required layout code.

Install from existing Replit workspace root:
  bash memeflow_style_cleanup_v167/install.sh

Rollback:
  bash memeflow_style_cleanup_v167/rollback.sh

No server/system restart is performed.
