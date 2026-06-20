import moment from 'moment';
import * as React from 'react';
import { getFileTitle } from '../../../dataview-util/dataview';
import type { UserOption } from '../../../src/settings';
import * as TaskMapable from '../../../utils/taskmapable';
import { counterModeClass } from '../../../utils/timelineclasses';
import { innerDateFormat, TaskDataModel, TaskStatus } from '../../../utils/tasks';
import { TaskListContext, TodayFocusEventHandlersContext, UserOptionContext } from './context';
import { createCollapseRegistry, NoDateView } from './dateview';
import { YearView } from './yearview';


const defaultTimelineProps = {
    userOptions: {} as UserOption,
    taskList: [] as TaskDataModel[]
}
const defaultTimelineStates = {
    filter: "" as string,
    todayFocus: false as boolean,
    controlsOpen: false as boolean,
    searchQuery: "" as string,
    bulkCollapsed: false as boolean,
    bulkCollapseVersion: 0 as number,
}
type TimelineProps = Readonly<typeof defaultTimelineProps>;
type TimelineStates = typeof defaultTimelineStates;

function textIncludesQuery(values: Array<string | undefined>, query: string) {
    return values
        .filter((value): value is string => typeof value === "string" && value.length > 0)
        .join(" ")
        .toLowerCase()
        .includes(query);
}

export function taskMatchesSearch(task: TaskDataModel, searchQuery: string) {
    const query = searchQuery.trim().toLowerCase();
    if (query.length === 0) return true;

    return textIncludesQuery([
        task.visual,
        task.text,
        task.link?.display,
        task.section?.subpath,
        task.section?.display,
        task.status,
        task.statusMarker,
        task.priority,
        task.recurrence,
        task.created?.format("YYYY-MM-DD"),
        task.start?.format("YYYY-MM-DD"),
        task.scheduled?.format("YYYY-MM-DD"),
        task.due?.format("YYYY-MM-DD"),
        task.completion?.format("YYYY-MM-DD"),
        ...[...task.dates.values()].map(date => date.format("YYYY-MM-DD")),
        ...task.tags,
    ], query);
}

export function taskMatchesSourceSearch(task: TaskDataModel, searchQuery: string) {
    const query = searchQuery.trim().toLowerCase();
    if (query.length === 0) return true;

    return textIncludesQuery([
        task.path,
        getFileTitle(task.path),
        task.link?.path,
    ], query);
}

export function filterTasksBySearch(taskList: TaskDataModel[], searchQuery: string) {
    if (searchQuery.trim().length === 0) return taskList;
    const directMatches = taskList.filter(task => taskMatchesSearch(task, searchQuery));
    return directMatches.length > 0 ? directMatches : taskList.filter(task => taskMatchesSourceSearch(task, searchQuery));
}

export function isTodoTask(task: TaskDataModel) {
    return [TaskStatus.due, TaskStatus.scheduled, TaskStatus.process, TaskStatus.start].includes(task.status as TaskStatus);
}

export function filterTasksByCounter(taskList: TaskDataModel[], filter: string, counterBehavior: string) {
    if (counterBehavior !== "Filter") return taskList;

    switch (filter) {
        case "todoFilter":
            return taskList.filter(isTodoTask);
        case "overdueFilter":
            return taskList.filter(task => task.status === TaskStatus.overdue);
        case "unplannedFilter":
            return taskList.filter(task => task.status === TaskStatus.unplanned || TaskMapable.isUndatedActiveTask(task));
        default:
            return taskList;
    }
}

export class TimelineView extends React.Component<TimelineProps, TimelineStates> {
    //private calendar: Map<string, Set<number>> = new Map();
    private rootRef: React.RefObject<HTMLDivElement>;
    private collapseRegistry = createCollapseRegistry();

    constructor(props: TimelineProps) {
        super(props);

        this.handleCounterFilterClick = this.handleCounterFilterClick.bind(this);
        this.handleTodayFocus = this.handleTodayFocus.bind(this);
        this.handleSearchChange = this.handleSearchChange.bind(this);
        this.handleToggleControls = this.handleToggleControls.bind(this);
        this.handleBulkCollapse = this.handleBulkCollapse.bind(this);
        this.rootRef = React.createRef<HTMLDivElement>();

        this.state = {
            filter: this.props.userOptions.defaultFilters,
            todayFocus: this.props.userOptions.defaultFilters ? false : this.props.userOptions.defaultTodayFocus,
            controlsOpen: false,
            searchQuery: "",
            bulkCollapsed: false,
            bulkCollapseVersion: 0,
        }
    }

    componentDidUpdate(previousProps: TimelineProps) {
        if (previousProps.userOptions.defaultFilters !== this.props.userOptions.defaultFilters) {
            this.setState({
                filter: this.props.userOptions.defaultFilters,
                todayFocus: this.props.userOptions.defaultFilters ? false : this.state.todayFocus,
            });
        }
        if (previousProps.userOptions.defaultTodayFocus !== this.props.userOptions.defaultTodayFocus) {
            this.setState({
                todayFocus: this.state.filter ? false : this.props.userOptions.defaultTodayFocus,
            });
        }
    }

    handleCounterFilterClick(filterName: string) {
        if (this.state.filter !== filterName) {
            this.setState({
                filter: filterName,
                todayFocus: false,
            })
        } else {
            this.setState({
                filter: ""
            })
        }
    }

    handleTodayFocus() {
        const todayFocus = !this.state.todayFocus;
        this.setState({
            todayFocus,
            filter: todayFocus ? "" : this.state.filter,
        })
    }

    handleSearchChange(event: React.FormEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement>) {
        const searchQuery = event.currentTarget.value;
        const hasSearch = searchQuery.trim().length > 0;
        this.setState({
            searchQuery,
            todayFocus: hasSearch ? false : this.state.todayFocus,
            filter: hasSearch ? "" : this.state.filter,
        })
    }

    handleToggleControls() {
        const controlsOpen = !this.state.controlsOpen;
        this.setState({
            controlsOpen,
            searchQuery: controlsOpen ? this.state.searchQuery : "",
        })
    }

    handleBulkCollapse(collapsed: boolean) {
        this.collapseRegistry.dates.clear();
        this.collapseRegistry.folders.clear();
        this.setState(state => ({
            bulkCollapsed: collapsed,
            bulkCollapseVersion: state.bulkCollapseVersion + 1,
        }));
    }

    render(): React.ReactNode {
        const involvedDates: Set<string> = new Set();
        const searchedTaskList = filterTasksBySearch(this.props.taskList, this.state.searchQuery);
        const taskList = filterTasksByCounter(searchedTaskList, this.state.filter, this.props.userOptions.counterBehavior);
        const noDateTaskList = taskList.filter(TaskMapable.isUndatedActiveTask);
        const datedTaskList = taskList.filter(t => !TaskMapable.isUndatedActiveTask(t));
        datedTaskList.forEach((t: TaskDataModel) => {
            const primaryDate = TaskMapable.getPrimaryTimelineDate(t);
            primaryDate && involvedDates.add(primaryDate.format(innerDateFormat));
        })

        if (!involvedDates.has(moment().format(innerDateFormat)))
            involvedDates.add(moment().format(innerDateFormat))

        const sortedDatas = [...involvedDates].sort();
        const earliestYear: number = +moment(sortedDatas.first()!.toString()).format("YYYY");
        const latestYear: number = +moment(sortedDatas.last()!.toString()).format("YYYY");
        const years = Array.from({ length: latestYear - earliestYear + 1 }, (_, i) => i + earliestYear);
        const firstDay = sortedDatas.first();
        const lastDay = sortedDatas.last();

        //const taskOfToday = taskList.filter(TaskMapable.filterDate(moment()));
        const overdueCount: number = searchedTaskList.filter(t => t.status === TaskStatus.overdue).length;
        const unplannedCount: number = searchedTaskList.filter(t => t.status === TaskStatus.unplanned || TaskMapable.isUndatedActiveTask(t)).length;
        const todoCount: number = searchedTaskList.filter(isTodoTask).length;

        const styles = new Array<string>;
        if (!this.props.userOptions.useCounters) styles.push("noCounters");
        if (!this.props.userOptions.useQuickEntry) styles.push("noQuickEntry");
        if (!this.props.userOptions.useYearHeader) styles.push("noYear");
        //if (!this.props.userOptions.useCompletedTasks) styles.push("noDone");
        if (!this.props.userOptions.useFileBadge &&
            !this.props.userOptions.usePriority &&
            !this.props.userOptions.useRecurrence &&
            !this.props.userOptions.useRelative &&
            !this.props.userOptions.useSection &&
            !this.props.userOptions.useTags) styles.push("noInfo");
        else {
            if (!this.props.userOptions.useFileBadge) styles.push("noFile");
            if (!this.props.userOptions.usePriority) styles.push("noPriority");
            if (!this.props.userOptions.useRecurrence) styles.push("noRepeat");
            if (!this.props.userOptions.useRelative) styles.push("noRelative");
            if (!this.props.userOptions.useSection) styles.push("noHeader");
            if (!this.props.userOptions.useTags) styles.push("noTag");
        }

        const quickEntryFile = this.props.userOptions.inbox || "Inbox.md";

        const baseStyles = [...new Set(styles)].join(" ");
        const counterMode = counterModeClass(this.state.filter, this.props.userOptions.counterBehavior);
        const todayFocus = this.state.todayFocus ? "todayFocus" : "";
        const controlsOpen = this.state.controlsOpen ? "controlsOpen" : "";
        return (
            <div ref={this.rootRef}
                className={`taskido ${baseStyles} ${counterMode} ${todayFocus} ${controlsOpen}`}
                id={`taskido${(new Date()).getTime()}`
                }>
                <TodayFocusEventHandlersContext.Provider value={{ handleTodayFocusClick: this.handleTodayFocus }}>
                    <UserOptionContext.Provider value={{
                        hideTags: this.props.userOptions.hideTags,
                        tagPalette: this.props.userOptions.tagColorPalette,
                        dateFormat: this.props.userOptions.dateFormat,
                        select: quickEntryFile,
                        forward: this.props.userOptions.forward,
                        useBuiltinStyle: this.props.userOptions.useBuiltinStyle,
                        groupByFolder: this.props.userOptions.groupByFolder,
                        controlsOpen: this.state.controlsOpen,
                        searchQuery: this.state.searchQuery,
                        handleSearchChange: this.handleSearchChange,
                        handleBulkCollapse: this.handleBulkCollapse,
                        counters: [
                            {
                                onClick: () => { this.handleCounterFilterClick('todoFilter') },
                                cnt: todoCount,
                                label: "Todo",
                                id: "todo",
                                ariaLabel: "Todo Tasks"
                            }, {
                                onClick: () => { this.handleCounterFilterClick('overdueFilter') },
                                cnt: overdueCount,
                                id: "overdue",
                                label: "Overdue",
                                ariaLabel: "Overdue Tasks"
                            }, {
                                onClick: () => { this.handleCounterFilterClick('unplannedFilter') },
                                cnt: unplannedCount,
                                id: "unplanned",
                                label: "Unplanned",
                                ariaLabel: "Unplanned Tasks"
                            }, {
                                onClick: this.handleToggleControls,
                                cnt: 0,
                                id: "controls",
                                label: "Controls",
                                ariaLabel: "Timeline controls"
                            }
                        ]
                    }}>
                        <div className='timelineYears'>
                            {years.map((y, i) => (
                                <TaskListContext.Provider value={
                                    {
                                        taskList: datedTaskList.filter(TaskMapable.filterYear(moment().year(y))),
                                        entryOnDate: this.props.userOptions.entryPosition === "top" ? firstDay! :
                                            this.props.userOptions.entryPosition === "bottom" ? lastDay! : moment().format(innerDateFormat),
                                    }
                                } key={i}>
                                    <YearView year={y} bulkCollapsed={this.state.bulkCollapsed}
                                        bulkCollapseVersion={this.state.bulkCollapseVersion}
                                        collapseRegistry={this.collapseRegistry} key={y} />
                                </TaskListContext.Provider>
                            ))}
                        </div>
                        <TaskListContext.Provider value={
                            {
                                taskList: noDateTaskList,
                                entryOnDate: moment().format(innerDateFormat),
                            }
                        }>
                            <NoDateView bulkCollapsed={this.state.bulkCollapsed}
                                bulkCollapseVersion={this.state.bulkCollapseVersion}
                                collapseRegistry={this.collapseRegistry} />
                        </TaskListContext.Provider>
                        {taskList.length === 0 && this.state.searchQuery.trim().length > 0 &&
                            <div className='noSearchResults'>No matching tasks</div>}
                    </UserOptionContext.Provider>
                </TodayFocusEventHandlersContext.Provider>
            </div >)
    }
}
