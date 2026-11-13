# Lace Relays Git workflow

- Use `develop` for future development. Before editing, check the current branch
  and working tree. Preserve the user's existing changes.
- The GitHub remote is `origin` at
  `https://github.com/AadityaDixit444/Lace-Relays.git`.
- After each completed coding task, review the full diff and run the available
  tests and relevant checks. If no tests exist, report that explicitly. Report
  any failures or checks that could not run.
- Before committing, check changed files and the staged diff for accidentally
  included secrets, credentials, API keys, tokens, private keys, and environment
  files. Do not commit secrets or expose their values in reports.
- Stage only files relevant to the task and create descriptive Git commits.
- Ask the user for approval before every push to GitHub. Present the destination
  branch, commits, and verification results before asking. Do not treat approval
  for one push as approval for later pushes.
- Never push directly to `main` without the user's explicit approval for that
  push. Never force-push or rewrite shared history without explicit approval.
- Keep application implementation paused until the user authorizes coding.
