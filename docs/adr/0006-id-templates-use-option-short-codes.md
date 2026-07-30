# ID templates use option short codes

Material ID templates stay on stable system tokens (numbers, words, dates, etc.) plus tokens bound to select fields via each option's optional short code (e.g. Family option Aluminum → `AL`). If a template requests that token and the short code is empty, use the option's display name. Rejected: injecting arbitrary fields or identifier values into IDs (POs/heat numbers are long, shared, and fragile when kinds are deleted).
