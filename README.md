# Tasks Calendar Wrapper

Community-maintained revival of [Leonezz/obsidian-tasks-calendar-wrapper](https://github.com/Leonezz/obsidian-tasks-calendar-wrapper).

This Obsidian plugin shows tasks in a timeline view, with quick entry, status counters, search, folder grouping, collapsible sections, and display settings for task metadata.

## Status

This project keeps the original plugin identity and credits, but is maintained separately because the timeline source and compatibility fixes now live in this repository.

The original README has been preserved as [README.upstream.md](README.upstream.md).

See [CHANGELOG.md](CHANGELOG.md) for the public list of changes and fixes in this maintenance fork.

## Current Focus

- Keep the timeline view from blanking on bad task data.
- Improve quick-entry behavior.
- Make settings easier to understand.
- Improve search and filtering inside the already-loaded task list.
- Preserve compatibility with common Tasks and Dataview task formats.

## Build

```bash
npm install
npm run build
```

The production build writes the bundled plugin files into `dist/`.

```bash
npm test
```

Runs the automated parser, timeline, interaction, and write-path checks.

## Release Bundle

A release should include these files:

- `main.js`
- `manifest.json`
- `styles.css`

The plugin id remains `tasks-calendar-wrapper` so existing installs can update without changing folders.

## Credits

Original plugin by [Leonezz](https://github.com/Leonezz).

This fork also vendors the small timeline source that was previously included as a submodule, so maintenance fixes can live in one repository.
