// @vitest-environment jsdom

import moment from "moment";
import * as React from "react";
import { readFileSync } from "fs";
import { resolve } from "path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Link } from "../dataview-util/markdown";
import { TimelineView } from "../Obsidian-Tasks-Timeline/src/components/timelineview";
import { defaultUserOptions } from "../src/settings";
import { TaskDataModel } from "../utils/tasks";

function makeTask(visual: string, path: string): TaskDataModel {
	const due = moment().startOf("day");
	return {
		task: true,
		symbol: "-",
		link: Link.file(path),
		section: Link.header(path, "Tasks"),
		header: Link.header(path, "Tasks"),
		path,
		line: 1,
		lineCount: 1,
		position: {
			start: { line: 1, col: 0, offset: 0 },
			end: { line: 1, col: visual.length, offset: visual.length },
		},
		list: 1,
		children: [],
		outlinks: [],
		text: visual,
		visual,
		tags: [],
		subtasks: [],
		real: true,
		status: "due",
		statusMarker: " ",
		checked: false,
		completed: false,
		fullyCompleted: false,
		dailyNote: false,
		order: 0,
		priority: "",
		recurrence: "",
		fontMatter: {},
		isTasksTask: false,
		due,
		dates: new Map([["due", due]]),
	};
}

function renderTimeline(tasks = [
	makeTask("Home task", "Areas/Home/Tasks.md"),
	makeTask("Project task", "Projects/Home/Tasks.md"),
]) {
	return render(<TimelineView
		taskList={tasks}
		userOptions={{
			...defaultUserOptions,
			dateFormat: "YYYY-MM-DD",
			defaultTodayFocus: false,
			groupByFolder: true,
			useQuickEntry: false,
		}} />);
}

beforeAll(() => {
	(globalThis as any).createEl = (tag: string) => document.createElement(tag);
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe("rendered timeline controls", () => {
	it("keeps the toolbar mounted while expanding and collapsing every section", () => {
		renderTimeline();
		const date = moment().format("YYYY-MM-DD");
		fireEvent.click(screen.getByRole("button", { name: "Timeline controls" }));
		const collapseAll = screen.getByRole("button", { name: "Collapse all dates and folders" });
		const dateHeader = screen.getByRole("button", { name: `Collapse ${date}` });

		fireEvent.click(collapseAll);

		expect(screen.getByRole("button", { name: "Collapse all dates and folders" })).toBe(collapseAll);
		expect(screen.getByRole("button", { name: `Expand ${date}` })).toBe(dateHeader);

		fireEvent.click(screen.getByRole("button", { name: "Expand all dates and folders" }));
		expect(screen.getByRole("button", { name: `Collapse ${date}` })).toBe(dateHeader);
	});

	it("keeps folders with identical leaf names separate by full path", () => {
		renderTimeline();

		expect(screen.getByRole("button", { name: "Collapse Areas/Home" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Collapse Projects/Home" })).toBeTruthy();
	});

	it("uses actual keyboard-accessible buttons for focus and counters", () => {
		renderTimeline();

		expect(screen.getByRole("button", { name: "Focus today" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Todo Tasks" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Timeline controls" })).toBeTruthy();
	});

	it("keeps bulk actions outside the search row so they cannot resize search", () => {
		const { container } = renderTimeline();
		fireEvent.click(screen.getByRole("button", { name: "Timeline controls" }));

		const controlsMainRow = container.querySelector(".controlsMainRow");
		const search = screen.getByRole("searchbox", { name: "Search visible tasks" });
		const bulkActions = container.querySelector(".bulkCollapseControls");

		expect(controlsMainRow?.contains(search)).toBe(true);
		expect(controlsMainRow?.contains(bulkActions)).toBe(false);
	});

	it("shows bulk actions only while Controls is open", () => {
		renderTimeline();
		expect(screen.queryByRole("button", { name: "Expand all dates and folders" })).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: "Timeline controls" }));
		expect(screen.getByRole("button", { name: "Expand all dates and folders" })).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Timeline controls" }));
		expect(screen.queryByRole("button", { name: "Expand all dates and folders" })).toBeNull();
	});

	it("processes each typed search character once and keeps focus", async () => {
		const searchHandler = vi.spyOn(TimelineView.prototype, "handleSearchChange");
		const user = userEvent.setup();
		renderTimeline();
		await user.click(screen.getByRole("button", { name: "Timeline controls" }));
		const search = screen.getByRole("searchbox", { name: "Search visible tasks" });

		await user.type(search, "Home");

		expect(searchHandler).toHaveBeenCalledTimes(4);
		expect(document.activeElement).toBe(search);
	});

	it("remembers a folded folder after search temporarily removes it", async () => {
		const user = userEvent.setup();
		renderTimeline();
		await user.click(screen.getByRole("button", { name: "Collapse Areas/Home" }));
		await user.click(screen.getByRole("button", { name: "Timeline controls" }));
		const search = screen.getByRole("searchbox", { name: "Search visible tasks" });

		await user.type(search, "Project task");
		expect(screen.queryByRole("button", { name: "Expand Areas/Home" })).toBeNull();
		await user.clear(search);

		expect(screen.getByRole("button", { name: "Expand Areas/Home" })).toBeTruthy();
	});

	it("contains a narrow-pane layout instead of forcing counters into one row", () => {
		const css = readFileSync(resolve(__dirname, "../styles.css"), "utf8");

		expect(css).toContain("@container (max-width: 430px)");
		expect(css).toContain("flex-wrap: wrap");
		expect(css).toContain("width: 100%");
	});

	it("overrides Obsidian's one-line button height for two-line counter cards", () => {
		const css = readFileSync(resolve(__dirname, "../styles.css"), "utf8");

		expect(css).toMatch(/\.taskido \.counter \{[\s\S]*?height: auto;[\s\S]*?min-height: 46px;/);
	});
});
