# Actual Medium remembered-ring checkpoint

`medium-native.json.gz` contains the unedited final checkpoint at tick 108000
from PR281's retained Riven Escarpment game, seeds Azure 20260925 / Ember 0.
Native identity and configured policy are `skirmish@1`; this is a
diagnostic fixture, not new map/mode admission.

The source was `201bad31e604c1ef41f6f4f933d93f7bfdc63f84`, merged at
`41e30deb3aac6b4533231514943a6b65ad3068ab`.
The retained complete game input `candidate-ember.json` has SHA256
`b88f49bc4a2fe586438895cdc799ffe1b3f2f647caa8045765aa989583b18ab3`.
Its enclosing sealed progress-retention archive has SHA256
`3e38af52a413f6027b3677ccae8606e32ebe73db9b9bb5baba312224956f0020`.
The compressed checkpoint is 26,566 bytes, SHA256
`6e9558c09c3aa89dbbd67a06d2d39437410bac659ab929ecddc39f99b19108d9`.
JSON whitespace was compacted and gzip used mtime 0; no checkpoint value was
edited. Initial 24 units and 150 food / 250 wood progressed through ordinary paid
orders and native combat for 3,600 seconds. The original game remained ongoing,
with 1,111 commands, zero rejects and exact repeat/recovery evidence.

The Scouts 76/79 are alive but idle inside remembered ground. Azure has no
currently disclosed positive wood source and 30 wood, while both teams have
unexplored ground outside the local reconnaissance ring. The bounded replay
runs only 60 more simulation seconds from this state, with unchanged ordinary
policy or a Scout-move-disabled control. It qualifies additional discovery,
not a terminal match, resource recovery, difficulty, balance or admission.
