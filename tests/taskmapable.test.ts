import { beforeEach, describe, expect, it, vi } from "vitest";
import moment from "moment";
import { Link } from "../dataview-util/markdown";
import {
	dailyNoteTaskParser,
	dataviewTaskParser,
	filterDate,
	filterYear,
	getPrimaryTimelineDate,
	ensureUndatedTaskPlacement,
	isUndatedActiveTask,
	postProcessor,
	tasksPluginTaskParser,
} from "../utils/taskmapable";
import { TaskDataModel, TaskStatus } from "../utils/tasks";

function makeTask(visual: string, overrides: Partial<TaskDataModel> = {}): TaskDataModel {
	const path = overrides.path || "Fixtures/Test.md";
	return {
		task: true,
		symbol: "-",
		link: Link.file(path),
		section: Link.file(path),
		header: Link.file(path),
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

async function parseTasksEmoji(visual: string, overrides: Partial<TaskDataModel> = {}) {
	return tasksPluginTaskParser(Promise.resolve(makeTask(visual, overrides)));
}

async function parseDataview(visual: string, overrides: Partial<TaskDataModel> = {}) {
	return dataviewTaskParser(Promise.resolve(makeTask(visual, overrides)));
}

describe("tasksPluginTaskParser", () => {
	it("parses Tasks emoji dates and priority while keeping readable task text", async () => {
		const task = await parseTasksEmoji("Pay rent #home 🔁 every month 🛫 2026-06-20 ⏳ 2026-06-19 📅 2026-06-18 ⏫");

		expect(task.visual).toBe("Pay rent #home");
		expect(task.start?.format("YYYY-MM-DD")).toBe("2026-06-20");
		expect(task.scheduled?.format("YYYY-MM-DD")).toBe("2026-06-19");
		expect(task.due?.format("YYYY-MM-DD")).toBe("2026-06-18");
		expect(task.priority).toBe("High");
		expect(task.recurrence).toBe("every month");
		expect(task.isTasksTask).toBe(true);
	});

	it("drops invalid Tasks emoji dates instead of storing invalid Moment objects", async () => {
		const task = await parseTasksEmoji("Bad dates 🛫 2026-02-31 ⏳ 2026-13-40 📅 2026-99-99");

		expect(task.visual).toBe("Bad dates");
		expect(task.start).toBeUndefined();
		expect(task.scheduled).toBeUndefined();
		expect(task.due).toBeUndefined();
		expect(task.dateWarnings).toEqual([
			{ field: "due", value: "2026-99-99" },
			{ field: "scheduled", value: "2026-13-40" },
			{ field: "start", value: "2026-02-31" },
		]);
		expect(task.isTasksTask).toBe(false);
	});

	it("parses completed date when the done emoji date is valid", async () => {
		const task = await parseTasksEmoji("Finished thing ✅ 2026-06-10");

		expect(task.visual).toBe("Finished thing");
		expect(task.completion?.format("YYYY-MM-DD")).toBe("2026-06-10");
	});
});

describe("dataviewTaskParser", () => {
	it("parses Dataview date and priority fields", async () => {
		const task = await parseDataview("Review [due:: 2026-06-15] [scheduled:: 2026-06-16] [start:: 2026-06-17] [created:: 2026-06-01] [completion:: 2026-06-09] [priority:: lowest]");

		expect(task.visual).toBe("Review");
		expect(task.due?.format("YYYY-MM-DD")).toBe("2026-06-15");
		expect(task.scheduled?.format("YYYY-MM-DD")).toBe("2026-06-16");
		expect(task.start?.format("YYYY-MM-DD")).toBe("2026-06-17");
		expect(task.created?.format("YYYY-MM-DD")).toBe("2026-06-01");
		expect(task.completion?.format("YYYY-MM-DD")).toBe("2026-06-09");
		expect(task.priority).toBe("Lowest");
	});

	it("strips Obsidian comments before cleaning Dataview fields", async () => {
		const task = await parseDataview("Visible %%hidden comment%% tail %%[ticktick_id:: abc123]%% [priority:: high]");

		expect(task.visual).toBe("Visible  tail");
		expect(task.priority).toBe("High");
	});

	it("ignores invalid Dataview dates without blanking, poisoning the task, or warning in the console", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const task = await parseDataview("Bad inline dates [due:: 2026-99-99] [scheduled:: not-a-date]");

		expect(task.visual).toBe("Bad inline dates");
		expect(task.due).toBeUndefined();
		expect(task.scheduled).toBeUndefined();
		expect(task.dateWarnings).toEqual([
			{ field: "due", value: "2026-99-99" },
			{ field: "scheduled", value: "not-a-date" },
		]);
		expect(warn).not.toHaveBeenCalled();

		warn.mockRestore();
	});

	it("accepts ISO Dataview date-time values without using loose Moment parsing", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const task = await parseDataview("ISO inline date [due:: 2026-06-15T09:30:00]");

		expect(task.due?.format("YYYY-MM-DD")).toBe("2026-06-15");
		expect(task.dateWarnings).toBeUndefined();
		expect(warn).not.toHaveBeenCalled();

		warn.mockRestore();
	});

	it("keeps created dates as metadata instead of timeline placement dates", async () => {
		const task = await parseDataview("Created only [created:: 2026-06-01]");

		expect(task.created?.format("YYYY-MM-DD")).toBe("2026-06-01");
		expect(filterDate(moment("2026-06-01", "YYYY-MM-DD", true))(task)).toBe(false);
		expect(filterYear(moment("2026-06-01", "YYYY-MM-DD", true))(task)).toBe(false);
	});

	it("places a mixed-date task once on its primary date", async () => {
		const task = await parseDataview("Real dates [due:: 2026-06-15] [scheduled:: 2026-06-16] [start:: 2026-06-17] [completion:: 2026-06-18]");
		task.dates.set("waiting", moment("2026-06-19", "YYYY-MM-DD", true));

		expect(getPrimaryTimelineDate(task)?.format("YYYY-MM-DD")).toBe("2026-06-15");
		expect(filterDate(moment("2026-06-15", "YYYY-MM-DD", true))(task)).toBe(true);
		expect(filterDate(moment("2026-06-16", "YYYY-MM-DD", true))(task)).toBe(false);
		expect(filterDate(moment("2026-06-17", "YYYY-MM-DD", true))(task)).toBe(false);
		expect(filterDate(moment("2026-06-18", "YYYY-MM-DD", true))(task)).toBe(false);
		expect(filterDate(moment("2026-06-19", "YYYY-MM-DD", true))(task)).toBe(false);
		expect(filterDate(moment("2026-06-20", "YYYY-MM-DD", true))(task)).toBe(false);
	});

	it("uses scheduled, start, completion, and custom dates only when there is no stronger placement date", async () => {
		const scheduledOnly = makeTask("Scheduled", {
			scheduled: moment("2026-06-16", "YYYY-MM-DD", true),
		});
		const startOnly = makeTask("Start", {
			start: moment("2026-06-17", "YYYY-MM-DD", true),
		});
		const completionOnly = makeTask("Done", {
			completion: moment("2026-06-18", "YYYY-MM-DD", true),
		});
		const customOnly = makeTask("Custom");
		customOnly.dates.set("waiting", moment("2026-06-19", "YYYY-MM-DD", true));

		expect(getPrimaryTimelineDate(scheduledOnly)?.format("YYYY-MM-DD")).toBe("2026-06-16");
		expect(getPrimaryTimelineDate(startOnly)?.format("YYYY-MM-DD")).toBe("2026-06-17");
		expect(getPrimaryTimelineDate(completionOnly)?.format("YYYY-MM-DD")).toBe("2026-06-18");
		expect(getPrimaryTimelineDate(customOnly)?.format("YYYY-MM-DD")).toBe("2026-06-19");
	});

	it("places completed tasks on their completion date before their original due date", async () => {
		const task = makeTask("Completed original due", {
			completed: true,
			due: moment("2026-06-05", "YYYY-MM-DD", true),
			completion: moment("2026-06-10", "YYYY-MM-DD", true),
		});

		expect(getPrimaryTimelineDate(task)?.format("YYYY-MM-DD")).toBe("2026-06-10");
		expect(filterDate(moment("2026-06-05", "YYYY-MM-DD", true))(task)).toBe(false);
		expect(filterDate(moment("2026-06-10", "YYYY-MM-DD", true))(task)).toBe(true);
	});

	it("uses forwarded dates before original past dates when forward-to-today adds one", () => {
		const task = makeTask("Past due forwarded", {
			due: moment("2026-06-05", "YYYY-MM-DD", true),
			status: TaskStatus.overdue,
		});
		task.dates.set(TaskStatus.overdue, moment("2026-06-12", "YYYY-MM-DD", true));

		expect(getPrimaryTimelineDate(task)?.format("YYYY-MM-DD")).toBe("2026-06-12");
		expect(filterDate(moment("2026-06-05", "YYYY-MM-DD", true))(task)).toBe(false);
		expect(filterDate(moment("2026-06-12", "YYYY-MM-DD", true))(task)).toBe(true);
	});
});

describe("dailyNoteTaskParser", () => {
	beforeEach(() => {
		Object.defineProperty(globalThis, "window", {
			configurable: true,
			value: {
			app: {
				plugins: {
					getPlugin: () => undefined,
				},
				internalPlugins: {
					getPluginById: () => ({
						instance: {
							options: {
								format: "YYYY-MM-DD",
								folder: "DailyNote",
							},
						},
					}),
				},
			},
			},
		});
	});

	it("infers dates from a daily note only when the task has no explicit dates", async () => {
		const task = await dailyNoteTaskParser()(Promise.resolve(makeTask("Daily item", {
			path: "DailyNote/2026-06-10.md",
		})));

		expect(task.dailyNote).toBe(true);
		expect(task.start?.format("YYYY-MM-DD")).toBe("2026-06-10");
		expect(task.scheduled?.format("YYYY-MM-DD")).toBe("2026-06-10");
		expect(task.created?.format("YYYY-MM-DD")).toBe("2026-06-10");
	});

	it("does not add daily-note dates when an explicit task date exists", async () => {
		const explicitDue = moment("2026-06-22", "YYYY-MM-DD", true);
		const task = await dailyNoteTaskParser()(Promise.resolve(makeTask("Explicit item", {
			path: "DailyNote/2026-06-10.md",
			due: explicitDue,
		})));

		expect(task.dailyNote).toBe(true);
		expect(task.due?.format("YYYY-MM-DD")).toBe("2026-06-22");
		expect(task.start).toBeUndefined();
		expect(task.scheduled).toBeUndefined();
		expect(task.created).toBeUndefined();
	});

	it("ignores notes outside the configured daily-note folder", async () => {
		const task = await dailyNoteTaskParser()(Promise.resolve(makeTask("Outside daily folder", {
			path: "Projects/2026-06-10.md",
		})));

		expect(task.dailyNote).toBe(false);
		expect(task.start).toBeUndefined();
		expect(task.scheduled).toBeUndefined();
		expect(task.created).toBeUndefined();
	});
});

describe("postProcessor status mapping", () => {
	it.each([
		["x", TaskStatus.done],
		["/", TaskStatus.process],
		["-", TaskStatus.cancelled],
		[">", TaskStatus.overdue],
		["<", TaskStatus.scheduled],
	])("maps marker %s to %s", async (marker, expectedStatus) => {
		const task = await postProcessor(Promise.resolve(makeTask("Marker task", {
			status: marker,
			statusMarker: marker,
		})));

		expect(task.status).toBe(expectedStatus);
	});

	it("keeps unknown undated marker tasks visible as unplanned", async () => {
		const task = await postProcessor(Promise.resolve(makeTask("Unknown marker", {
			status: "?",
			statusMarker: "?",
		})));

		expect(task.status).toBe(TaskStatus.unplanned);
	});
});

describe("ensureUndatedTaskPlacement", () => {
	it("keeps undated unplanned tasks visible without assigning them to today", async () => {
		const task = await postProcessor(Promise.resolve(makeTask("No date")));

		ensureUndatedTaskPlacement(task);

		expect(task.status).toBe(TaskStatus.unplanned);
		expect(getPrimaryTimelineDate(task)).toBeUndefined();
		expect(isUndatedActiveTask(task)).toBe(true);
		expect(filterDate(moment("2026-06-13", "YYYY-MM-DD", true))(task)).toBe(false);
	});

	it("keeps undated in-progress tasks active without assigning them to today", async () => {
		const task = await postProcessor(Promise.resolve(makeTask("Started but undated", {
			status: "/",
			statusMarker: "/",
		})));

		ensureUndatedTaskPlacement(task);

		expect(task.status).toBe(TaskStatus.process);
		expect(getPrimaryTimelineDate(task)).toBeUndefined();
		expect(isUndatedActiveTask(task)).toBe(true);
		expect(filterDate(moment("2026-06-13", "YYYY-MM-DD", true))(task)).toBe(false);
	});

	it("does not place undated completed or cancelled tasks unless another rule does", async () => {
		const completed = await postProcessor(Promise.resolve(makeTask("Done without date", {
			completed: true,
			status: "x",
			statusMarker: "x",
		})));
		const cancelled = await postProcessor(Promise.resolve(makeTask("Cancelled without date", {
			status: "-",
			statusMarker: "-",
		})));

		ensureUndatedTaskPlacement(completed);
		ensureUndatedTaskPlacement(cancelled);

		expect(getPrimaryTimelineDate(completed)).toBeUndefined();
		expect(getPrimaryTimelineDate(cancelled)).toBeUndefined();
		expect(isUndatedActiveTask(completed)).toBe(false);
		expect(isUndatedActiveTask(cancelled)).toBe(false);
	});
});
