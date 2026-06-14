# Changelog

## 0.4.0

First public revival release maintained from this fork. Most fixes in this release were guided by issues reported against the original plugin.

### Fixed

- Invalid task dates no longer blank the timeline view.
- Invalid task dates now show a warning badge on the affected task instead of failing silently.
- Undated active tasks now stay visible in a separate `Unplanned / No Date` section.
- Mixed-date tasks now appear once on their primary timeline date instead of duplicating.
- Wiki links, external links, tags, row clicks, and edit controls now behave as separate click targets.
- Non-recurring checkbox toggles from the wrapper now update faster.

### Improved

- Tasks and Dataview date parsing are more tolerant, including priority handling and markdown comment cleanup.
- Quick entry now handles folder targets and missing headings more reliably.
- Settings labels and layout are clearer.
- Task metadata is more compact, with clearer priority and invalid-date badges.

### Added

- Search, display controls, folder grouping, and collapsible date and folder sections.
- Automated tests for parser behavior, date placement, row interactions, toggles, quick-entry writes, and display setting persistence.
