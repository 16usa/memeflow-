MEMEFLOW READABILITY V176

Goal
----
Improve small-text readability without creating another CSS layer.

V176 replaces the current canonical file.

Readable scale
--------------
micro/system: 11px
metadata:     12px
small UI:     13px
body:         14px
panel text:   15px
title token:  17px

Base weight: 500
small/meta line-height: 1.4
body line-height: 1.45

Font stack
----------
Inter,
ui-sans-serif,
system-ui,
-apple-system,
BlinkMacSystemFont,
"Segoe UI",
sans-serif

Muted X text remains #71767B.
Primary X text remains #E7E9EA.

V176 also bundles V175 Settings unification:
- if V175 already exists locally, it is preserved;
- if the workspace is still on V174, V175 is applied transactionally first.

Install
-------
unzip -o Memflow-Readability-V176.zip && bash memeflow_readability_v176/install.sh

Audit
-----
bash memeflow_readability_v176/audit.sh

Rollback
--------
bash memeflow_readability_v176/rollback.sh

No server/system restart is performed.
