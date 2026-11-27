# Security Audit Pipeline

The `.github/workflows/security-audit.yml` workflow runs static analyzers against the Solidity contracts on a weekly schedule (every Monday at 03:00 UTC) and on manual trigger.

## Analyzers

| Tool | Scope | Output |
|---|---|---|
| [Slither](https://github.com/crytic/slither) | Solidity in `src/` | SARIF → Security tab |
| [Semgrep](https://semgrep.dev) | Solidity in `src/` (rule set `p/solidity`) | SARIF → Security tab |

Findings are uploaded to the repository Security tab as SARIF. The workflow itself never fails on findings; a failing step would hide new issues behind broken builds. Triage happens in the Security tab.

## Triaging findings

1. Open the **Security → Code scanning** tab.
2. Review each finding. If it is a false positive, dismiss it with a reason.
3. Real issues get a private security report (see CONTRIBUTING.md ground rules) or a tracked issue.

## Adding a new analyzer

1. Add a new job to `.github/workflows/security-audit.yml`.
2. Run the analyzer and write its output to a `.sarif` file.
3. Upload the `.sarif` file with `github/codeql-action/upload-sarif`, using a unique `category` name.
4. Set `fail-on: none` (or the equivalent flag) so findings do not block the workflow.
5. Document the tool in the table above.
