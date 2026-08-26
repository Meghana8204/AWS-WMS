# Commit Message Convention

This repository follows the [Conventional Commits](https://www.conventionalcommits.org/) specification.

## Format Structure

```text
<type>(<scope>): <short summary in imperative mood>

[optional detailed description / bullet points]

[optional footer, e.g. references: Closes #123]
```

## Types

- **`feat`**: A new feature or enhancement (e.g., `feat(gate-entry): make vehicle photo mandatory`)
- **`fix`**: A bug fix (e.g., `fix(rfq): resolve postgres pr_id constraint error`)
- **`refactor`**: Code change that neither fixes a bug nor adds a feature
- **`style`**: Formatting, CSS, UI appearance changes
- **`perf`**: A code change that improves performance
- **`test`**: Adding missing tests or correcting existing tests
- **`chore`**: Maintenance tasks, dependencies, `.gitignore`, build configs
- **`docs`**: Documentation only changes

## Scopes

- `(gate-entry)`
- `(procurement)`
- `(receiving)`
- `(finance)`
- `(inventory)`
- `(auth)`
