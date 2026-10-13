# Contributing

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <short description>

[optional body]
```

### Allowed types

| Type | Use for |
|------|---------|
| `feat` | New feature or user-visible behavior |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no logic change |
| `refactor` | Code change, not a feat or fix |
| `perf` | Performance improvement |
| `test` | Tests |
| `build` | Build system, dependencies |
| `ci` | CI configuration |
| `chore` | Maintenance, tooling |

### Examples

```text
feat: add Timeline view for decision steps
fix: resolve enrich progress borrow in serve worker
docs: update README install instructions
chore: bump adrv to 0.1.10
```

### Do not use

- Ticket prefixes like `CN-1234:` in the subject line
- Vague subjects: `update`, `wip`, `fix stuff`

### Release (maintainers)

Before `cargo publish`, refresh the embedded UI so `cargo install` matches the React app:

```bash
npm run build -w @adrv/web
npm run embed-static
cargo publish --allow-dirty --target-dir ./target
```

### Git hook

Enable the commit-msg hook (once per clone):

```bash
git config core.hooksPath .githooks
```

The hook rejects commits whose subject does not match the conventional format.
