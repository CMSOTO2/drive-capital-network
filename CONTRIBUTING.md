# Contributing

Thanks for helping out. This guide covers the workflow; [ARCHITECTURE.md](./ARCHITECTURE.md) covers the code.

## Setup

```bash
nvm use          # Node 24, from .nvmrc
pnpm install     # also installs the git hooks
pnpm check       # should pass before you change anything
```

## Workflow

1. Branch from `main`: `feat/<topic>`, `fix/<topic>`, `docs/<topic>`, and so on.
2. Make small commits. Each one should build and pass `pnpm check`.
3. Open a pull request against `main`. The template asks for a summary, how you tested it, and a docs check.
4. CI runs `pnpm check`. A PR merges once CI is green and a reviewer approves.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/), enforced by commitlint on every commit:

```text
feat(parse): accept tabs between words
fix(cli): exit 2 when the input is a directory
docs: explain the tie-breaking rule
```

| Type       | Use for                             |
| ---------- | ----------------------------------- |
| `feat`     | New behavior a user can see         |
| `fix`      | A bug fix                           |
| `refactor` | Code change with no behavior change |
| `test`     | Tests only                          |
| `docs`     | Documentation only                  |
| `chore`    | Tooling, dependencies, config       |

Scopes match the folders and modules: `parse`, `network`, `report`, `cli`, `schemas`.

## Code standards

- **Layers:** constants in `src/constants.ts`, Zod schemas in `src/schemas/`, pure logic in `src/core/`, I/O only in `src/cli/`. Imports point one way: `cli → core → schemas → constants`.
- **No magic values** in logic. Add them to `src/constants.ts`.
- **Validate at the boundary.** New input shapes get a Zod schema, and their types come from `z.infer`.
- **Erasable TypeScript only** (no enums or namespaces), so `pnpm dev` can run the source directly. Relative imports use `.ts` extensions.
- **Tests mirror `src/`.** New behavior needs a test. If you change output, update the `examples/*.expected.txt` golden files on purpose, not just to make tests pass.

Formatting (oxfmt) and lint fixes (oxlint) are applied automatically on commit. Don't bypass the hooks with `--no-verify`.

## Docs stay with the code

README.md, ARCHITECTURE.md, ROADMAP.md, and CHANGELOG.md describe the code as it is. When a change makes any of them wrong (module table, edge-case table, options, exit codes, roadmap checkboxes), fix it in the same pull request. A significant design choice also gets a short record in [`docs/decisions/`](./docs/decisions/).
