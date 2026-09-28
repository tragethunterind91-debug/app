# TopPass5 Auth Testing Playbook

- Verify email/password login returns staged auth when birthday is configured.
- Verify birthday completes login when Crypto Type Pass is disabled.
- Verify birthday advances to Crypto Type Pass quiz only when Layer 3 is enabled.
- Verify wrong passwords increment rate limits; normal accounts lock temporarily after 5 failures.
- Verify Hardcore Mode users do not get blocked by temporary lockout and are deleted when configured failure limits are reached.
- Verify Advance Mode items reject normal value, update, delete, share, bulk-delete, and TOTP access unless the passphrase is supplied.
