import { Model } from "backbone";
import { ItemView, moment, Notice, WorkspaceLeaf } from "obsidian";
import { ObsidianBridge } from 'Obsidian-Tasks-Timeline/src/obsidianbridge';
import { ObsidianTaskAdapter } from "Obsidian-Tasks-Timeline/src/taskadapter";
import { createRoot, Root } from 'react-dom/client';
import * as TaskMapable from 'utils/taskmapable';
import { TaskDataModel, TaskStatus, TaskStatusMarkerMap } from "utils/tasks";
import { defaultUserOptions, UserOption } from "./settings";


export const CALENDAR_VIEW = "tasks_calendar_view";
export const TIMELINE_VIEW = "tasks_timeline_view";

function compareValues<T>(a: T | undefined, b: T | undefined, descending = false) {
    if (a === undefined && b === undefined) return 0;
    if (a === undefined) return 1;
    if (b === undefined) return -1;
    if (a === b) return 0;
    const result = a < b ? -1 : 1;
    return descending ? -result : result;
}

function compareMoments(a: moment.Moment | undefined, b: moment.Moment | undefined, descending = false) {
    if (!a?.isValid() && !b?.isValid()) return 0;
    if (!a?.isValid()) return 1;
    if (!b?.isValid()) return -1;
    const result = a.valueOf() - b.valueOf();
    return descending ? -result : result;
}

function getTaskComparator(sortOption: string | undefined) {
    switch (sortOption) {
        case "(t1, t2) => t1.order >= t2.order ? -1 : 1":
            return (t1: TaskDataModel, t2: TaskDataModel) => compareValues(t1.order, t2.order, true);
        case "(t1, t2) => t1.visual.trim() <= t2.visual.trim() ? -1 : 1":
            return (t1: TaskDataModel, t2: TaskDataModel) => compareValues((t1.visual || "").trim(), (t2.visual || "").trim());
        case "(t1, t2) => t1.visual.trim() >= t2.visual.trim() ? -1 : 1":
            return (t1: TaskDataModel, t2: TaskDataModel) => compareValues((t1.visual || "").trim(), (t2.visual || "").trim(), true);
        case "(t1, t2) => t1.start <= t2.start ? -1 : 1":
            return (t1: TaskDataModel, t2: TaskDataModel) => compareMoments(t1.start, t2.start);
        case "(t1, t2) => t1.start >= t2.start ? -1 : 1":
            return (t1: TaskDataModel, t2: TaskDataModel) => compareMoments(t1.start, t2.start, true);
        case "(t1, t2) => t1.due <= t2.due ? -1 : 1":
            return (t1: TaskDataModel, t2: TaskDataModel) => compareMoments(t1.due, t2.due);
        case "(t1, t2) => t1.due >= t2.due ? -1 : 1":
            return (t1: TaskDataModel, t2: TaskDataModel) => compareMoments(t1.due, t2.due, true);
        case "(t1, t2) => t1.tags <= t2.tags ? -1 : 1":
            return (t1: TaskDataModel, t2: TaskDataModel) => compareValues(t1.tags.join(","), t2.tags.join(","));
        case "(t1, t2) => t1.tags >= t2.tags ? -1 : 1":
            return (t1: TaskDataModel, t2: TaskDataModel) => compareValues(t1.tags.join(","), t2.tags.join(","), true);
        case "(t1, t2) => t1.order <= t2.order ? -1 : 1":
        default:
            return (t1: TaskDataModel, t2: TaskDataModel) => compareValues(t1.order, t2.order);
    }
}

export abstract class BaseTasksView extends ItemView {
    protected root: Root;
    //protected dataAdapter: ObsidianTaskAdapter;
    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
        //this.dataAdapter = new ObsidianTaskAdapter(this.app);
    }
}

export class TasksTimelineView extends BaseTasksView {
    private taskListModel = new Model({
        taskList: [] as TaskDataModel[],
    });

    private isReloading: boolean = false;
    private pendingReload: boolean = false;
    private reloadTimer: number | undefined = undefined;
    private userOptionModel = new Model({ ...defaultUserOptions });
    static view: TasksTimelineView | null = null;
    constructor(leaf: WorkspaceLeaf) {
        super(leaf);

        this.parseTasks = this.parseTasks.bind(this);
        this.onReloadTasks = this.onReloadTasks.bind(this);
        this.onUpdateOptions = this.onUpdateOptions.bind(this);
        TasksTimelineView.view = this;
        //this.userOptionModel.set({ ...defaultUserOptions });
    }

    async onOpen(): Promise<void> {

        this.registerEvent(this.app.metadataCache.on('resolved', this.onReloadTasks));
        this.registerEvent(this.app.workspace.on("window-open", this.onReloadTasks));

        const { containerEl } = this;
        const container = containerEl.children[1];

        container.empty();
        this.root = createRoot(container);
        this.root.render(
            <ObsidianBridge plugin={this} userOptionModel={this.userOptionModel} taskListModel={this.taskListModel} />
        )
        this.onReloadTasks();

    }

    async onClose(): Promise<void> {
        // this.app.metadataCache.off('resolved', this.onReloadTasks);
        if (this.reloadTimer !== undefined) {
            window.clearTimeout(this.reloadTimer);
            this.reloadTimer = undefined;
        }
    }

    onUpdateOptions(opt: UserOption) {
        this.userOptionModel.clear();
        this.userOptionModel.set({ ...opt });
        this.onReloadTasks();
    }

    async onReloadTasks() {
        if (this.reloadTimer !== undefined) {
            window.clearTimeout(this.reloadTimer);
        }
        this.reloadTimer = window.setTimeout(() => {
            this.reloadTimer = undefined;
            this.reloadTasksNow();
        }, 250);
    }

    async reloadTasksNow() {
        if (this.isReloading) {
            this.pendingReload = true;
            return;
        }
        this.isReloading = true;
        this.pendingReload = false;
        const fileExcludeFilter = this.userOptionModel.get("excludePaths") || [];
        const fileIncludeFilter = this.userOptionModel.get("includePaths") || [];
        const fileIncludeTagsFilter = this.userOptionModel.get("fileIncludeTags") || [];
        const fileExcludeTagsFilter = this.userOptionModel.get("fileExcludeTags") || [];
        const adapter = new ObsidianTaskAdapter(this.app);
        adapter.generateTasksList(fileIncludeFilter, fileExcludeFilter, fileIncludeTagsFilter, fileExcludeTagsFilter)
            .then(() => {
                const taskList = adapter.getTaskList();
                const taskListPromise = this.parseTasks(taskList)
                taskListPromise.then(tasks => {
                    tasks = this.filterTasks(tasks);
                    tasks = tasks.sort(getTaskComparator(this.userOptionModel.get("sort")));
                    this.taskListModel.set({ taskList: tasks });
                }).catch(reason => {
                    console.error("Error when parsing task items: ", reason);
                    new Notice("Error when parsing task items: " + reason, 5000);
                });
            })
            .catch(reason => {
                console.error("Error when generating tasks from files: ", reason);
                new Notice("Error when generating tasks from files: " + reason, 5000);
            })
            .finally(() => {
                this.isReloading = false;
                if (this.pendingReload) {
                    this.onReloadTasks();
                }
            });
    }

    filterTasks(taskList: TaskDataModel[]) {
        return taskList
            /**
             * Status Filters
             */
            .filter((task: TaskDataModel) => {
                if (this.userOptionModel.get("hideStatusTasks")?.length === 0) return true;
                const hideStatusTasks = this.userOptionModel.get("hideStatusTasks");
                if (hideStatusTasks?.includes(task.statusMarker)) return false;
                if (hideStatusTasks?.some(m => TaskStatusMarkerMap[m as keyof typeof TaskStatusMarkerMap] === task.status)) return false;
                return true;
            })
            /**
             * Tag Filters
             */
            .filter((task) => {
                if (!this.userOptionModel.get("useIncludeTags")) return true;
                const tagIncludes = this.userOptionModel.get("taskIncludeTags");
                if (!tagIncludes) return true;
                if (tagIncludes.length === 0) return true;
                if (tagIncludes.some(tag => task.tags.includes(tag))) return true;
                return false;
            })
            .filter((task) => {
                if (!this.userOptionModel.get("useExcludeTags")) return true;
                const tagExcludes = this.userOptionModel.get("taskExcludeTags");
                if (!tagExcludes) return true;
                if (tagExcludes.length === 0) return true;
                if (tagExcludes.every(tag => !task.tags.includes(tag))) return true;
                return false;
            })
            /**
             * Filter empty
             */
            .filter((task: TaskDataModel) => {
                if (!this.userOptionModel.get("filterEmpty")) return true;
                return task.visual && task.visual.trim() !== "";
            })

    }

    async parseTasks(taskList: TaskDataModel[]): Promise<TaskDataModel[]> {

        const stautsOrder = this.userOptionModel.get("taskStatusOrder");

        const dailyNoteFormatParser = TaskMapable.dailyNoteTaskParser();

        const forward = this.userOptionModel.get("forward");
        /**
         * initial parsers
         */
        let taskListPromise: Promise<TaskDataModel>[] = taskList.map(async item => item)
            .map(TaskMapable.tasksPluginTaskParser)
            .map(TaskMapable.dataviewTaskParser)
            .map(dailyNoteFormatParser)
            .map(TaskMapable.tagsParser)
            .map(TaskMapable.remainderParser)
            .map(TaskMapable.postProcessor)
            .map(async (task: Promise<TaskDataModel>): Promise<TaskDataModel> => {
                const t = await task;
                return TaskMapable.ensureUndatedTaskPlacement(t);
            })
            //.map(TaskMapable.taskLinkParser)

            /**
             * Option Forward
             * Current behavior: show unplanned, overdue, and past-dated active tasks in today's part.
             */
            .map(async (task: Promise<TaskDataModel>): Promise<TaskDataModel> => {
                return new Promise((resolve) => {
                    task.then(t => {
                        if (!forward) {
                            resolve(t);
                            return;
                        }
                        if (t.status === TaskStatus.done && !t.completion &&
                            !t.due && !t.start && !t.scheduled && !t.created) t.dates.set("done-unplanned", moment());
                        else if (TaskMapable.shouldForwardTaskToToday(t)) t.dates.set(TaskStatus.overdue, moment())
                        resolve(t);
                    })
                })
            })
            /**
             * Post processer
             */
            .map((task: Promise<TaskDataModel>) => {
                return new Promise(resolve => {
                    task.then(t => {
                        if (!stautsOrder) {
                            resolve(t);
                            return;
                        }
                        if (!stautsOrder.includes(t.status)) return t;
                        t.order = stautsOrder.indexOf(t.status) + 1;
                        resolve(t);
                    });
                });
            });

        if (this.userOptionModel.get("convert24HourTimePrefix")) {
            taskListPromise = taskListPromise.map((task: Promise<TaskDataModel>) => {
                return new Promise(resolve => {
                    task.then(t => {
                        if (!t.visual || t.visual.length < 5) {
                            resolve(t);
                            return;
                        }
                        const timePrefix = moment(t.visual.substring(0, 5), "HH:mm", true);
                        if (!timePrefix.isValid()) {
                            resolve(t);
                            return;
                        }
                        const updatedTimePrefix = timePrefix.format("h:mm a");
                        t.visual = updatedTimePrefix + t.visual.substring(5);
                        resolve(t);
                    });
                });
            });
        }

        return Promise.all(taskListPromise);
    }

    getViewType(): string {
        return TIMELINE_VIEW;
    }

    getDisplayText(): string {
        return "Tasks Timeline";
    }

    getIcon(): string {
        return "calendar-clock";
    }
}
