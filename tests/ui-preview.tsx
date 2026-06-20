import moment from "moment";
import * as React from "react";
import { createRoot } from "react-dom/client";
import { Link } from "../dataview-util/markdown";
import { TimelineView } from "../Obsidian-Tasks-Timeline/src/components/timelineview";
import { defaultUserOptions } from "../src/settings";
import { TaskDataModel } from "../utils/tasks";

(globalThis as any).createEl = (tag: string) => document.createElement(tag);
(Array.prototype as any).first ||= function () { return this[0]; };
(Array.prototype as any).last ||= function () { return this[this.length - 1]; };
(Array.prototype as any).contains ||= Array.prototype.includes;

function task(visual: string, path: string, offset: number): TaskDataModel {
	const due = moment().startOf("day");
	return {
		task: true, symbol: "-", link: Link.file(path), section: Link.header(path, "Tasks"),
		header: Link.header(path, "Tasks"), path, line: offset + 1, lineCount: 1,
		position: { start: { line: offset, col: 0, offset }, end: { line: offset, col: visual.length, offset: offset + visual.length } },
		list: 1, children: [], outlinks: [], text: visual, visual, tags: [], subtasks: [], real: true,
		status: "due", statusMarker: " ", checked: false, completed: false, fullyCompleted: false,
		dailyNote: false, order: offset, priority: "", recurrence: "", fontMatter: {}, isTasksTask: false,
		due, dates: new Map([["due", due]]),
	};
}

const tasks = [
	task("Schedule equipment maintenance and confirm the service window", "Operations/Building/Tasks.md", 1),
	task("Review this week's daily notes", "Daily Notes/Tasks.md", 2),
	task("Replace the air filter", "Home/Maintenance/Tasks.md", 3),
	task("Plan the garden watering route", "Home/Garden/Tasks.md", 4),
	task("Review the project brief", "Projects/Client Work/Tasks.md", 5),
];

const options = { ...defaultUserOptions, groupByFolder: true, defaultTodayFocus: false, useQuickEntry: true };
for (const id of ["wide", "narrow"]) {
	createRoot(document.getElementById(id)!).render(<TimelineView taskList={tasks} userOptions={options} />);
}
