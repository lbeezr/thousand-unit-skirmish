# Relocated Sheep client positions — 4 October 2026

Owner: wildlife worker, branch `codex/sheep-relocated-client`, retaining default
integration, release delivery and ordinary-game acceptance.

The previous renderer admitted only the original 0.35-unit grazing radius.
Accepted Herd travel therefore disappeared after leaving that radius. Default
map setup now supplies map bounds, admitting finite disclosed actual positions
within the same half-open cell bounds as authority. Fog checks the actual pose
after validation. Omission, depletion and hidden poses still hide immediately.
Legacy standalone previews without a map retain their grazing-radius guard.

The minimap previously checked the authored cell before resolving the current
pose. It now checks current position first. Actual picking and resource rings
already consume renderer positions; focused tests exercise those production
functions with opposing authored/current fog cells for both seats, all true
ownership labels, carcasses, depletion and omission.

Focused checks cover renderer lifecycle/bounds, admitted static-art directions,
real Three CPU positions, actual main picking/minimap resource loops and army,
Farm and fishing regressions. The existing real two-seat Herd/recovery scenario
also feeds disclosed snapshots through the production renderer and requires
more than two world units of represented travel. Reviewed source, counts and
release digest are recorded in the owning PR.

This slice keeps the existing admitted static views and explicit carcass marker.
New private action captures use body-forward yaw zero = +Z, positive yaw toward
+X; the old nose-facing views have a 42-degree neck/body offset. Do not mix
their heading contracts. New action clips and collar binding remain with Sheep
art task `01a101a8-fba6-7323-a40c-27efd0112007`, pending deterministic source/root
validation and the existing publication boundary.

Ordinary owned selection and Herd/Stop controls are the next narrow slice.
These checks prove CPU positioning and HTTP/WebSocket behavior. Native WebGL
appearance remains unverified: this executor's Chromium SUID sandbox helper is
unconfigured, and no sandbox bypass is authorized. The active Railway owner
retains deployment; merge or a release digest alone does not prove delivery.
