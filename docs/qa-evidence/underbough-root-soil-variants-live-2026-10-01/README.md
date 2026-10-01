# Initial woodland soil capture — incomplete

The browser saved Underbough single/mixed screenshots, then its renderer proof
failed with `CDP Runtime.evaluate timed out`. Investigation returned HTTP 404
for the new root-soil-02 WebP: its filename had not yet been admitted to the
server's explicit public asset list. These screenshots therefore do not prove
the new texture loaded. Preserve this failed attempt; the corrected retry uses
a fresh isolated server and a separate evidence folder.
