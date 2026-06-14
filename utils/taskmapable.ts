import { getFileTitle } from "dataview-util/dataview";
import { Link } from "dataview-util/markdown";
import { moment } from "obsidian";
import * as TasksUtil from "./tasks";

type DailyNoteSettings = {
    format: string;
    folder: string;
};

function parseTaskDate(value: string): moment.Moment | undefined {
    const parsedDate = moment(value, TasksUtil.TaskRegularExpressions.dateFormat, true);
    return parsedDate.isValid() ? parsedDate : undefined;
}

function addDateWarning(item: TasksUtil.TaskDataModel, field: string, value: string) {
    item.dateWarnings = item.dateWarnings || [];
    item.dateWarnings.push({ field, value: value.trim() });
}

function getDailyNoteSettings(): DailyNoteSettings {
    try {
        const app = (window as any).app;
        const periodicDaily = app.plugins?.getPlugin?.("periodic-notes")?.settings?.daily;
        if (periodicDaily?.enabled) {
            return {
                format: periodicDaily.format || TasksUtil.innerDateFormat,
                folder: (typeof periodicDaily.folder === "string" ? periodicDaily.folder : "").trim(),
            };
        }

        const dailyOptions = app.internalPlugins?.getPluginById?.("daily-notes")?.instance?.options;
        return {
            format: dailyOptions?.format || TasksUtil.innerDateFormat,
            folder: (typeof dailyOptions?.folder === "string" ? dailyOptions.folder : "").trim(),
        };
    } catch {
        return { format: TasksUtil.innerDateFormat, folder: "" };
    }
}

function notePathIsInsideFolder(path: string, folder: string) {
    const normalizedPath = path.replace(/\\/g, "/");
    const normalizedFolder = folder.replace(/\\/g, "/").replace(/^\/|\/$/g, "");
    return normalizedFolder === "" || normalizedPath.startsWith(`${normalizedFolder}/`);
}

function parseDataviewDate(value: string): moment.Moment | undefined {
    const trimmedValue = value.trim();
    const strictDate = moment(trimmedValue, TasksUtil.TaskRegularExpressions.dateFormat, true);
    if (strictDate.isValid()) return strictDate;

    const isoDate = moment(trimmedValue, moment.ISO_8601, true);
    return isoDate.isValid() ? isoDate : undefined;
}

function normalizePriority(value: string): TasksUtil.PriorityLabel {
    const normalizedValue = value.trim().toLowerCase();
    switch (normalizedValue) {
        case "highest":
        case "🔺":
            return "Highest";
        case "high":
        case "⏫":
            return "High";
        case "medium":
        case "🔼":
            return "Medium";
        case "low":
        case "🔽":
            return "Low";
        case "lowest":
        case "⏬":
            return "Lowest";
        case "none":
        case "no":
            return "No";
        default:
            return value.trim();
    }
}

export function filterDate(date: moment.Moment) {
    return filterByDateTime(date, "date");
}

export function filterYear(date: moment.Moment) {
    return filterByDateTime(date, "year");
}

export function getPrimaryTimelineDate(item: TasksUtil.TaskDataModel): moment.Moment | undefined {
    const forwardedDate = item.dates.get(TasksUtil.TaskStatus.overdue) ||
        item.dates.get(TasksUtil.TaskStatus.unplanned) ||
        item.dates.get("done-unplanned");
    if (forwardedDate) return forwardedDate;

    if (item.completed && item.completion) return item.completion;
    if (item.due) return item.due;
    if (item.scheduled) return item.scheduled;
    if (item.start) return item.start;
    if (item.completion) return item.completion;

    return [...item.dates.values()]
        .sort((a, b) => a.valueOf() - b.valueOf())[0];
}

export function isUndatedActiveTask(item: TasksUtil.TaskDataModel) {
    return !getPrimaryTimelineDate(item) &&
        item.status !== TasksUtil.TaskStatus.done &&
        item.status !== TasksUtil.TaskStatus.cancelled;
}

export function ensureUndatedTaskPlacement(item: TasksUtil.TaskDataModel) {
    if (getPrimaryTimelineDate(item)) return item;
    if (item.status === TasksUtil.TaskStatus.done || item.status === TasksUtil.TaskStatus.cancelled) return item;
    return item;
}

function filterByDateTime(date: moment.Moment, by: moment.unitOfTime.StartOf) {
    return (item: TasksUtil.TaskDataModel) => {
        const primaryDate = getPrimaryTimelineDate(item);
        return primaryDate ? date.isSame(primaryDate, by) : false;
    }
}

export function filterDateRange(from: moment.Moment, to: moment.Moment) {
    return filterByDateTimeRange(from, to, 'date');
}

function filterByDateTimeRange(from: moment.Moment, to: moment.Moment, by: moment.unitOfTime.StartOf) {
    return (item: TasksUtil.TaskDataModel) => {
        const primaryDate = getPrimaryTimelineDate(item);
        return primaryDate ? primaryDate.isBetween(from, to, by) : false;
    }
}

/**
 * This function is taken from TasksPlugin, it is originally named fromLine.
 * We use this function to extract information that matches the TasksPlugin format.
 * @param item 
 * @returns 
 */
export async function tasksPluginTaskParser(item: Promise<TasksUtil.TaskDataModel>): Promise<TasksUtil.TaskDataModel> {
    return new Promise((resolve, reject) => {
        item
            .then((itemValue) => {
                // Check the line to see if it is a markdown task.
                let description = itemValue.visual || "";
                // Keep matching and removing special strings from the end of the
                // description in any order. The loop should only run once if the
                // strings are in the expected order after the description.
                let matched: boolean;
                let priority: TasksUtil.PriorityLabel = "";
                let startDate: moment.Moment | undefined = undefined;
                let scheduledDate: moment.Moment | undefined = undefined;
                //const scheduledDateIsInferred = false;
                let dueDate: moment.Moment | undefined = undefined;
                let doneDate: moment.Moment | undefined = undefined;
                let recurrenceRule = '';
                //const recurrence: string | null = null;
                // Tags that are removed from the end while parsing, but we want to add them back for being part of the description.
                // In the original task description they are possibly mixed with other components
                // (e.g. #tag1 <due date> #tag2), they do not have to all trail all task components,
                // but eventually we want to paste them back to the task description at the end
                let trailingTags = '';
                // Add a "max runs" failsafe to never end in an endless loop:
                const maxRuns = 20;
                let runs = 0;
                do {
                    matched = false;
                    const priorityMatch = description.match(TasksUtil.TaskRegularExpressions.priorityRegex);
                    if (priorityMatch !== null) {
                        priority = TasksUtil.TasksPrioritySymbolToLabel[priorityMatch[1] as TasksUtil.TasksPrioritySymbol];
                        description = description.replace(TasksUtil.TaskRegularExpressions.priorityRegex, '').trim();
                        matched = true;
                    }

                    const doneDateMatch = description.match(TasksUtil.TaskRegularExpressions.doneDateRegex);
                    if (doneDateMatch !== null) {
                        doneDate = parseTaskDate(doneDateMatch[1]);
                        if (!doneDate) addDateWarning(itemValue, "completion", doneDateMatch[1]);
                        description = description.replace(TasksUtil.TaskRegularExpressions.doneDateRegex, '').trim();
                        matched = true;
                    }

                    const dueDateMatch = description.match(TasksUtil.TaskRegularExpressions.dueDateRegex);
                    if (dueDateMatch !== null) {
                        dueDate = parseTaskDate(dueDateMatch[1]);
                        if (!dueDate) addDateWarning(itemValue, "due", dueDateMatch[1]);
                        description = description.replace(TasksUtil.TaskRegularExpressions.dueDateRegex, '').trim();
                        matched = true;
                    }

                    const scheduledDateMatch = description.match(TasksUtil.TaskRegularExpressions.scheduledDateRegex);
                    if (scheduledDateMatch !== null) {
                        scheduledDate = parseTaskDate(scheduledDateMatch[1]);
                        if (!scheduledDate) addDateWarning(itemValue, "scheduled", scheduledDateMatch[1]);
                        description = description.replace(TasksUtil.TaskRegularExpressions.scheduledDateRegex, '').trim();
                        matched = true;
                    }

                    const startDateMatch = description.match(TasksUtil.TaskRegularExpressions.startDateRegex);
                    if (startDateMatch !== null) {
                        startDate = parseTaskDate(startDateMatch[1]);
                        if (!startDate) addDateWarning(itemValue, "start", startDateMatch[1]);
                        description = description.replace(TasksUtil.TaskRegularExpressions.startDateRegex, '').trim();
                        matched = true;
                    }

                    const recurrenceMatch = description.match(TasksUtil.TaskRegularExpressions.recurrenceRegex);
                    if (recurrenceMatch !== null) {
                        // Save the recurrence rule, but *do not parse it yet*.
                        // Creating the Recurrence object requires a reference date (e.g. a due date),
                        // and it might appear in the next (earlier in the line) tokens to parse
                        recurrenceRule = recurrenceMatch[1].trim();
                        description = description.replace(TasksUtil.TaskRegularExpressions.recurrenceRegex, '').trim();
                        matched = true;
                    }

                    // Match tags from the end to allow users to mix the various task components with
                    // tags. These tags will be added back to the description below
                    const tagsMatch = description.match(TasksUtil.TaskRegularExpressions.hashTagsFromEnd);
                    if (tagsMatch != null) {
                        description = description.replace(TasksUtil.TaskRegularExpressions.hashTagsFromEnd, '').trim();
                        matched = true;
                        const tagName = tagsMatch[0].trim();
                        // Adding to the left because the matching is done right-to-left
                        trailingTags = trailingTags.length > 0 ? [tagName, trailingTags].join(' ') : tagName;
                    }

                    runs++;
                } while (matched && runs <= maxRuns);


                // Add back any trailing tags to the description. We removed them so we can parse the rest of the
                // components but now we want them back.
                // The goal is for a task of them form 'Do something #tag1 (due) tomorrow #tag2 (start) today'
                // to actually have the description 'Do something #tag1 #tag2'
                if (trailingTags.length > 0) description += ' ' + trailingTags;

                const isTasksTask = [startDate, scheduledDate, dueDate, doneDate].some(d => !!d);

                itemValue.visual = description;
                itemValue.priority = priority;
                itemValue.recurrence = recurrenceRule;
                itemValue.isTasksTask = isTasksTask;
                itemValue.due = dueDate;
                itemValue.scheduled = scheduledDate;
                itemValue.completion = doneDate;
                itemValue.start = startDate;
                itemValue.checked = description.replace(' ', '').length !== 0;

                resolve(itemValue);
            })
            .catch(() => reject());
    });
}

export async function dataviewTaskParser(item: Promise<TasksUtil.TaskDataModel>): Promise<TasksUtil.TaskDataModel> {
    return new Promise((resolve, reject) => {
        item
            .then((itemValue) => {
                let itemText = (itemValue.visual || "").replace(TasksUtil.TaskRegularExpressions.markdownCommentRegex, '').trim();
                const inlineFields = itemText.match(TasksUtil.TaskRegularExpressions.keyValueRegex);
                if (!inlineFields) {
                    itemValue.visual = itemText;
                    resolve(itemValue);
                    return;
                }
                for (const inlineField of inlineFields) {
                    // this is necessary since every time RegEx.exec,
                    // the lastIndex changed like an internal state.
                    TasksUtil.TaskRegularExpressions.keyValueRegex.lastIndex = 0;
                    const tkv = TasksUtil.TaskRegularExpressions.keyValueRegex.exec(inlineField)!;
                    const [text, key, value] = [tkv[0], tkv[1], tkv[2]];
                    itemText = itemText.replace(text, '');

                    const normalizedKey = key.trim().toLowerCase();
                    if (!TasksUtil.DataviewTaskFieldCollection.includes(normalizedKey)) continue;
                    if (normalizedKey === "priority") {
                        itemValue.priority = normalizePriority(value);
                        continue;
                    }

                    const fieldDate = parseDataviewDate(value);
                    if (!fieldDate) {
                        addDateWarning(itemValue, normalizedKey, value);
                        continue;
                    }
                    switch (normalizedKey) {
                        case "due":
                            itemValue.due = fieldDate; break;
                        case "scheduled":
                            itemValue.scheduled = fieldDate; break;
                        case "start":
                            itemValue.start = fieldDate; break;
                        case "complete":
                        case "completion":
                        case "done":
                            itemValue.completion = fieldDate; break;
                        case "created":
                            itemValue.created = fieldDate; break;
                        default:
                            itemValue.dates.set(normalizedKey, fieldDate); break;
                    }
                }
                itemValue.visual = itemText.trim();
                resolve(itemValue);
            })
            .catch(() => reject());
    });
}

export function dailyNoteTaskParser() {
    return async (item: Promise<TasksUtil.TaskDataModel>): Promise<TasksUtil.TaskDataModel> => {
        return new Promise((resolve, reject) => {
            item
                .then((itemValue) => {
                    const dailyNoteSettings = getDailyNoteSettings();
                    if (!notePathIsInsideFolder(itemValue.path, dailyNoteSettings.folder)) {
                        resolve(itemValue);
                        return;
                    }
                    const taskFile: string = getFileTitle(itemValue.path);
                    const dailyNoteFormat = dailyNoteSettings.format.split("/").pop() || TasksUtil.innerDateFormat;
                    const dailyNoteDate = moment(taskFile, dailyNoteFormat, true);
                    itemValue.dailyNote = dailyNoteDate.isValid();
                    if (!itemValue.dailyNote) {
                        resolve(itemValue);
                        return;
                    }
                    const hasExplicitDate = itemValue.due ||
                        itemValue.start ||
                        itemValue.scheduled ||
                        itemValue.completion ||
                        itemValue.created ||
                        itemValue.dates.size > 0;
                    if (hasExplicitDate) {
                        resolve(itemValue);
                        return;
                    }
                    if (!itemValue.start) itemValue.start = dailyNoteDate;
                    if (!itemValue.scheduled) itemValue.scheduled = dailyNoteDate;
                    if (!itemValue.created) itemValue.created = dailyNoteDate;

                    resolve(itemValue);
                })
                .catch(() => reject());
        })
    }
}
/**
 * !! NEED improvement
 * @param item 
 * @returns 
 */
export function taskLinkParser(item: TasksUtil.TaskDataModel) {

    item.outlinks = [];

    let outerLinkMatch = TasksUtil.TaskRegularExpressions.outerLinkRegex.exec(item.visual!);
    let innerLinkMatch = TasksUtil.TaskRegularExpressions.innerLinkRegex.exec(item.visual!);
    let dataviewDateMatch = TasksUtil.TaskRegularExpressions.keyValueRegex.exec(item.visual!);

    const buildLink = (text: string, display: string, path: string, index: number, inner: boolean) => {
        item.visual = item.visual!.replace(text, display);

        if (item.outlinks.some(l => l.path === path)) return;

        const link = Link.file(path, inner, display);
        link.subpath = index.toString();
        item.outlinks.push(link);
    };

    while (!!outerLinkMatch || (!!innerLinkMatch && !dataviewDateMatch)) {
        if (!!outerLinkMatch && (!!innerLinkMatch && !dataviewDateMatch)) {
            if (outerLinkMatch.index < innerLinkMatch.index) {
                buildLink(outerLinkMatch[0], outerLinkMatch[1], outerLinkMatch[2], outerLinkMatch.index, false);
                innerLinkMatch = TasksUtil.TaskRegularExpressions.innerLinkRegex.exec(item.visual!);
                dataviewDateMatch = TasksUtil.TaskRegularExpressions.keyValueRegex.exec(item.visual!);
                (!!innerLinkMatch && !dataviewDateMatch) &&
                    buildLink(innerLinkMatch[0], innerLinkMatch[1], innerLinkMatch[1], innerLinkMatch.index, true);
            } else {
                buildLink(innerLinkMatch[0], innerLinkMatch[1], innerLinkMatch[1], innerLinkMatch.index, true);
                outerLinkMatch = TasksUtil.TaskRegularExpressions.outerLinkRegex.exec(item.visual!);
                (!!outerLinkMatch) &&
                    buildLink(outerLinkMatch[0], outerLinkMatch[1], outerLinkMatch[2], outerLinkMatch.index, false);
            }
            innerLinkMatch = TasksUtil.TaskRegularExpressions.innerLinkRegex.exec(item.visual!);
            dataviewDateMatch = TasksUtil.TaskRegularExpressions.keyValueRegex.exec(item.visual!);
            outerLinkMatch = TasksUtil.TaskRegularExpressions.outerLinkRegex.exec(item.visual!);
        } else if (outerLinkMatch) {
            buildLink(outerLinkMatch[0], outerLinkMatch[1], outerLinkMatch[2], outerLinkMatch.index, false);
            outerLinkMatch = TasksUtil.TaskRegularExpressions.outerLinkRegex.exec(item.visual!);
        } else if (!!innerLinkMatch && !dataviewDateMatch) {
            buildLink(innerLinkMatch[0], innerLinkMatch[1], innerLinkMatch[1], innerLinkMatch.index, true);
            innerLinkMatch = TasksUtil.TaskRegularExpressions.innerLinkRegex.exec(item.visual!);
            dataviewDateMatch = TasksUtil.TaskRegularExpressions.keyValueRegex.exec(item.visual!);
        }
    }

    return item;
}

export async function remainderParser(item: Promise<TasksUtil.TaskDataModel>): Promise<TasksUtil.TaskDataModel> {
    return new Promise((resolve, reject) => {
        item
            .then((itemValue) => {
                const match = itemValue.text.match(TasksUtil.TaskRegularExpressions.remainderRegex);
                if (!match) { resolve(itemValue); return; }
                itemValue.text = itemValue.text.replace(match[0], "");
                resolve(itemValue);
            })
            .catch(() => reject());
    });
}

export async function tagsParser(item: Promise<TasksUtil.TaskDataModel>): Promise<TasksUtil.TaskDataModel> {
    return new Promise((resolve, reject) => {
        item
            .then((itemValue) => {
                const match = itemValue.visual?.match(TasksUtil.TaskRegularExpressions.hashTags);
                if (!match) {
                    resolve(itemValue);
                    return;
                }
                for (const m of match) {
                    itemValue.visual = itemValue.visual?.replace(m, "");
                    const tag = m.trim();
                    itemValue.tags.push(tag);
                }
                resolve(itemValue);
            })
            .catch(() => reject());
    })

}

function dateBasedStatusParser(item: TasksUtil.TaskDataModel) {
    if (!item.due && !item.scheduled &&
        !item.start && !item.completion && item.dates.size === 0) {
        item.status = TasksUtil.TaskStatus.unplanned;
        if (item.completed) item.status = TasksUtil.TaskStatus.done;
        return item;
    }

    if (item.completed && (item.scheduled && item.scheduled.isAfter() ||
        item.start && item.start.isAfter())) {
        item.status = TasksUtil.TaskStatus.cancelled;
        return item;
    }

    if (item.completed) {
        item.status = TasksUtil.TaskStatus.done;
        return item;
    }

    const today = moment();
    if (item.due && item.due.isBefore(today, 'date')) {
        item.status = TasksUtil.TaskStatus.overdue;
        return item;
    }

    if (item.due && item.due.isSame(today, 'date')) {
        item.status = TasksUtil.TaskStatus.due;
        return item;
    }

    if (item.start && item.start.isBefore(today, 'date')) {
        item.status = TasksUtil.TaskStatus.process;
        return item;
    }

    if (item.scheduled && item.scheduled.isBefore(today, 'date')) {
        item.status = TasksUtil.TaskStatus.start;
        return item;
    }

    item.status = TasksUtil.TaskStatus.scheduled;
    return item;
}

function markerBasedStatusParser(item: TasksUtil.TaskDataModel) {
    if (!Object.keys(TasksUtil.TaskStatusMarkerMap).contains(item.status)) return dateBasedStatusParser(item);
    item.status = (TasksUtil.TaskStatusMarkerMap as any)[item.status];
    return item;
}

export async function postProcessor(item: Promise<TasksUtil.TaskDataModel>): Promise<TasksUtil.TaskDataModel> {
    //["overdue", "due", "scheduled", "start", "process", "unplanned","done","cancelled"]

    //create ------------ scheduled ------- start --------- due --------- (done)
    //        scheduled              start         process       overdue
    return new Promise((resolve, reject) => {
        item
            .then((itemValue) => {
                resolve(markerBasedStatusParser(itemValue));
            })
            .catch(() => reject());
    });
}
