import { describe, expect, it } from "vitest";
import moment from "moment";
import { Link } from "../dataview-util/markdown";
import {
	filterTasksByCounter,
	filterTasksBySearch,
	taskMatchesSearch,
	taskMatchesSourceSearch,
} from "../Obsidian-Tasks-Timeline/src/components/timelineview";
import { counterModeClass } from "../utils/timelineclasses";
import { TaskDataModel } from "../utils/tasks";

function makeTask(visual: string, overrides: Partial<TaskDataModel> = {}): TaskDataModel {
	const path = overrides.path || "Projects/Wrapper Demo Tasks.md";
	return {
		task: true,
		symbol: "-",
		link: Link.file(path),
		section: Link.header(path, "Dataview Style"),
		header: Link.header(path, "Dataview Style"),
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
		status: " ",
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
		dates: new Map(),
		...overrides,
	};
}

describe("timeline counter mode classes", () => {
	it("clears the counter class when no task count is active", () => {
		expect(counterModeClass("", "Filter")).toBe("");
		expect(counterModeClass("", "Focus")).toBe("");
	});

	it("builds filter classes for show-only mode", () => {
		expect(counterModeClass("todoFilter", "Filter")).toBe("todoFilter");
		expect(counterModeClass("overdueFilter", "Filter")).toBe("overdueFilter");
		expect(counterModeClass("unplannedFilter", "Filter")).toBe("unplannedFilter");
	});

	it("builds focus classes for highlight mode", () => {
		expect(counterModeClass("todoFilter", "Focus")).toBe("todoFocus");
		expect(counterModeClass("overdueFilter", "Focus")).toBe("overdueFocus");
		expect(counterModeClass("unplannedFilter", "Focus")).toBe("unplannedFocus");
	});
});

describe("timeline counter filtering", () => {
	const due = makeTask("Due task", { status: "due", due: moment("2026-06-20") });
	const overdue = makeTask("Overdue task", { status: "overdue", due: moment("2026-06-18") });
	const unplanned = makeTask("Unplanned task", { status: "unplanned" });
	const tasks = [due, overdue, unplanned];

	it("removes nonmatching tasks before folder groups are rendered in show-only mode", () => {
		expect(filterTasksByCounter(tasks, "todoFilter", "Filter")).toEqual([due]);
		expect(filterTasksByCounter(tasks, "overdueFilter", "Filter")).toEqual([overdue]);
		expect(filterTasksByCounter(tasks, "unplannedFilter", "Filter")).toEqual([unplanned]);
	});

	it("keeps every task in highlight mode", () => {
		expect(filterTasksByCounter(tasks, "todoFilter", "Focus")).toEqual(tasks);
	});

	it("keeps every task when no counter is selected", () => {
		expect(filterTasksByCounter(tasks, "", "Filter")).toEqual(tasks);
	});
});

describe("timeline search matching", () => {
	it("matches task text", () => {
		expect(taskMatchesSearch(makeTask("Compare scheduled metadata"), "compare")).toBe(true);
		expect(taskMatchesSearch(makeTask("Capture inbox idea"), "inbox")).toBe(true);
		expect(taskMatchesSearch(makeTask("Review project note"), "project")).toBe(true);
	});

	it("does not match every task from a source note title or folder path", () => {
		expect(taskMatchesSearch(makeTask("Task text without the keyword"), "demo")).toBe(false);
		expect(taskMatchesSearch(makeTask("Task text without the keyword"), "projects")).toBe(false);
	});

	it("can still match source note titles and paths as a fallback", () => {
		expect(taskMatchesSourceSearch(makeTask("Task text without the keyword"), "demo")).toBe(true);
		expect(taskMatchesSourceSearch(makeTask("Task text without the keyword"), "projects")).toBe(true);
	});

	it("prefers direct task-text results before falling back to source titles", () => {
		const sourceTitleMatchOnly = makeTask("Unrelated task", { path: "Projects/Wrapper Demo Tasks.md" });
		const directTaskMatch = makeTask("Demo task", { path: "Inbox.md" });

		expect(filterTasksBySearch([sourceTitleMatchOnly, directTaskMatch], "demo")).toEqual([directTaskMatch]);
		expect(filterTasksBySearch([sourceTitleMatchOnly], "demo")).toEqual([sourceTitleMatchOnly]);
	});

	it("matches section headings", () => {
		expect(taskMatchesSearch(makeTask("Task text without the keyword"), "dataview")).toBe(true);
	});
});
