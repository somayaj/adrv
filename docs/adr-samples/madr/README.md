# MADR sample ADRs (upstream copy)

Ten decision records from the [MADR](https://github.com/adr/madr) project (`develop` branch), copied for local study and adrv demos.

**License:** See each file and [MADR ADR-0001](https://github.com/adr/madr/blob/develop/docs/decisions/0001-use-CC0-or-MIT-as-license.md).

## View with adrv

```bash
adrv serve --root ./docs/adr-samples/madr --port 8080 --web ./packages/web/dist
```

Your main corpus stays under `docs/adr/`; this folder is separate so IDs do not clash with `0002`–`0009`.

## Files

| File | Topic |
|------|--------|
| 0000 | Use Markdown ADRs |
| 0001 | CC0 or MIT license |
| 0002 | No numbers in headings |
| 0003 | Own MADR tools |
| 0004 | Own TOC tool |
| 0005 | Dashes in filenames |
| 0006 | Names as identifier |
| 0007 | No emphasized line headings |
| 0008 | Status field |
| 0009 | Links between ADRs |

Source: https://github.com/adr/madr/tree/develop/docs/decisions
