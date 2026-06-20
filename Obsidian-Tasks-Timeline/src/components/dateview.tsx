import moment from 'moment';
import * as React from 'react';
import { TaskDataModel, doneDateSymbol, dueDateSymbol, recurrenceSymbol, scheduledDateSymbol, startDateSymbol } from '../../../utils/tasks';
import * as Icons from './asserts/icons';
import { QuickEntryHandlerContext, TaskItemEventHandlersContext, TaskListContext, TodayFocusEventHandlersContext, UserOptionContext } from './context';
import { TaskItemView } from './taskitemview';

export type CollapseRegistry = {
    dates: Map<string, boolean>,
    folders: Map<string, boolean>,
};

export const createCollapseRegistry = (): CollapseRegistry => ({
    dates: new Map(),
    folders: new Map(),
});

const defaultDateProps = {
    date: moment(),
    bulkCollapsed: false as boolean,
    bulkCollapseVersion: 0 as number,
    collapseRegistry: createCollapseRegistry(),
}

type DateViewProps = Readonly<typeof defaultDateProps>;
type DateViewState = {
    collapsed: boolean,
    bulkCollapseVersion: number,
};

export class DateView extends React.Component<DateViewProps, DateViewState> {
    getDateKey() {
        return this.props.date.format("YYYY-MM-DD");
    }

    constructor(props: DateViewProps) {
        super(props);
        this.state = {
            collapsed: props.collapseRegistry.dates.get(props.date.format("YYYY-MM-DD")) ?? props.bulkCollapsed,
            bulkCollapseVersion: props.bulkCollapseVersion,
        };
        this.toggleCollapsed = this.toggleCollapsed.bind(this);
    }

    toggleCollapsed() {
        const collapsed = !this.isCollapsed();
        this.props.collapseRegistry.dates.set(this.getDateKey(), collapsed);
        this.setState({
            collapsed,
            bulkCollapseVersion: this.props.bulkCollapseVersion,
        });
    }

    isCollapsed() {
        return this.props.bulkCollapseVersion !== this.state.bulkCollapseVersion
            ? this.props.bulkCollapsed
            : this.state.collapsed;
    }

    render(): React.ReactNode {
        const collapsed = this.isCollapsed();
        return (
            <UserOptionContext.Consumer>{({ dateFormat }) => (
                < TaskListContext.Consumer >{({ taskList, entryOnDate }) => {
                    const entryOnDateMoment = moment(entryOnDate);
                    const isEntryDate = this.props.date.format("YYYYMMDD") === entryOnDateMoment.format("YYYYMMDD");
                    const isToday = this.props.date.isSame(moment(), 'date');
                    return (
                        <div>
                            {isEntryDate && <TodayFocus visual={"Focus On Today"} />}
                            {isEntryDate && <Counters />}
                            {isEntryDate && <TimelineControls />}
                            {isEntryDate && <QuickEntry />}
                            {
                                taskList.length > 0 && <div className={isToday ? "details today" : "details"}
                                    data-year={this.props.date.format("YYYY")}
                                    data-types={[...new Set(taskList.map((t => t.status)))].join(" ")}>
                                    <DateHeader
                                        thisDate={this.props.date.format(dateFormat)}
                                        taskCount={taskList.length}
                                        collapsed={collapsed}
                                        onToggle={this.toggleCollapsed} />
                                    {!collapsed && <div className={isToday ? "details today" : "details"}
                                        data-year={this.props.date.format("YYYY")}
                                        data-types={[...new Set(taskList.map((t => t.status)))].join(" ")}>
                                        <TaskListContext.Provider value={{ taskList: taskList, entryOnDate: entryOnDate }}>
                                            <NormalDateContent date={this.props.date} bulkCollapsed={this.props.bulkCollapsed}
                                                bulkCollapseVersion={this.props.bulkCollapseVersion}
                                                collapseRegistry={this.props.collapseRegistry} />
                                        </TaskListContext.Provider>
                                    </div>}
                                </div>
                            }
                        </div>
                    )

                }}
                </TaskListContext.Consumer>
            )}
            </UserOptionContext.Consumer >
        )
    }
}

type NoDateViewState = {
    collapsed: boolean,
    bulkCollapseVersion: number,
};

type NoDateViewProps = {
    bulkCollapsed: boolean,
    bulkCollapseVersion: number,
    collapseRegistry: CollapseRegistry,
};

export class NoDateView extends React.Component<NoDateViewProps, NoDateViewState> {
    constructor(props: NoDateViewProps) {
        super(props);
        this.state = {
            collapsed: props.collapseRegistry.dates.get("no-date") ?? props.bulkCollapsed,
            bulkCollapseVersion: props.bulkCollapseVersion,
        };
        this.toggleCollapsed = this.toggleCollapsed.bind(this);
    }

    toggleCollapsed() {
        const collapsed = !this.isCollapsed();
        this.props.collapseRegistry.dates.set("no-date", collapsed);
        this.setState({
            collapsed,
            bulkCollapseVersion: this.props.bulkCollapseVersion,
        });
    }

    isCollapsed() {
        return this.props.bulkCollapseVersion !== this.state.bulkCollapseVersion
            ? this.props.bulkCollapsed
            : this.state.collapsed;
    }

    render(): React.ReactNode {
        const collapsed = this.isCollapsed();
        return (
            <TaskListContext.Consumer>{({ taskList, entryOnDate }) => (
                taskList.length > 0 &&
                <div className="details noDateDetails" data-types={[...new Set(taskList.map((t => t.status)))].join(" ") + " unplanned"}>
                    <DateHeader
                        thisDate="Unplanned / No Date"
                        taskCount={taskList.length}
                        collapsed={collapsed}
                        onToggle={this.toggleCollapsed} />
                    {!collapsed &&
                        <div className="details noDateDetails" data-types={[...new Set(taskList.map((t => t.status)))].join(" ") + " unplanned"}>
                            <TaskListContext.Provider value={{ taskList: taskList, entryOnDate: entryOnDate }}>
                                <NormalDateContent date={moment.invalid()} bulkCollapsed={this.props.bulkCollapsed}
                                    bulkCollapseVersion={this.props.bulkCollapseVersion}
                                    collapseRegistry={this.props.collapseRegistry} />
                            </TaskListContext.Provider>
                        </div>}
                </div>
            )}
            </TaskListContext.Consumer>
        )
    }
}

type DateHeaderProps = {
    thisDate: string,
    taskCount: number,
    collapsed: boolean,
    onToggle: () => void,
}
class DateHeader extends React.Component<DateHeaderProps> {
    handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        this.props.onToggle();
    }

    render(): React.ReactNode {
        return (
            <div className='dateLine' role='button' tabIndex={0} onClick={this.props.onToggle}
                onKeyDown={(event) => this.handleKeyDown(event)}
                aria-expanded={!this.props.collapsed}
                aria-label={`${this.props.collapsed ? "Expand" : "Collapse"} ${this.props.thisDate}`}>
                <span className='collapseIcon' aria-hidden='true'>
                    <span className={this.props.collapsed ? 'foldChevron collapsed' : 'foldChevron expanded'}></span>
                </span>
                <div className='date'>{this.props.thisDate}</div>
                <div className='dateCount'>{this.props.taskCount}</div>
            </div>
        )
    }
}

type NormalDateContentProps = {
    date: moment.Moment,
    bulkCollapsed: boolean,
    bulkCollapseVersion: number,
    collapseRegistry: CollapseRegistry,
}

type NormalDateContentState = {
    collapsedFolders: Record<string, boolean>,
    defaultFolderCollapsed: boolean,
    bulkCollapseVersion: number,
}

class NormalDateContent extends React.Component<NormalDateContentProps, NormalDateContentState> {
    getFolderStateKey(folderPath: string) {
        const dateKey = this.props.date.isValid() ? this.props.date.format("YYYY-MM-DD") : "no-date";
        return `${dateKey}::${this.getFolderKey(folderPath)}`;
    }

    constructor(props: NormalDateContentProps) {
        super(props);
        this.state = {
            collapsedFolders: {},
            defaultFolderCollapsed: props.bulkCollapsed,
            bulkCollapseVersion: props.bulkCollapseVersion,
        };
        this.toggleFolderCollapsed = this.toggleFolderCollapsed.bind(this);
    }

    getFolderPath(path: string) {
        const pathParts = path.split('/').filter(part => part.length > 0);
        if (pathParts.length <= 1) return "";
        return pathParts.slice(0, -1).join('/');
    }

    groupTasksByFolder(taskList: TaskDataModel[]) {
        const groupedTasks = new Map<string, TaskDataModel[]>();
        taskList.forEach(task => {
            const folderPath = this.getFolderPath(task.path);
            const tasks = groupedTasks.get(folderPath) || [];
            tasks.push(task);
            groupedTasks.set(folderPath, tasks);
        });
        return [...groupedTasks.entries()].sort(([folderA], [folderB]) => folderA.localeCompare(folderB));
    }

    getFolderKey(folderPath: string) {
        return folderPath || "vault-root";
    }

    getFolderLabel(folderPath: string, allFolderPaths: string[]) {
        if (!folderPath) return "Vault root";
        const folderName = folderPath.split('/').last() || folderPath;
        const duplicateName = allFolderPaths.filter(path => path.split('/').last() === folderName).length > 1;
        return duplicateName ? folderPath : folderName;
    }

    toggleFolderCollapsed(folderPath: string) {
        const folderKey = this.getFolderKey(folderPath);
        const folderStateKey = this.getFolderStateKey(folderPath);
        const bulkChanged = this.props.bulkCollapseVersion !== this.state.bulkCollapseVersion;
        const defaultFolderCollapsed = bulkChanged ? this.props.bulkCollapsed : this.state.defaultFolderCollapsed;
        const collapsedFolders = bulkChanged ? {} : this.state.collapsedFolders;
        const isCollapsed = collapsedFolders[folderKey] ?? defaultFolderCollapsed;
        this.props.collapseRegistry.folders.set(folderStateKey, !isCollapsed);
        this.setState({
            collapsedFolders: {
                ...collapsedFolders,
                [folderKey]: !isCollapsed,
            },
            defaultFolderCollapsed,
            bulkCollapseVersion: this.props.bulkCollapseVersion,
        });
    }

    handleFolderKeyDown(event: React.KeyboardEvent<HTMLDivElement>, folderPath: string) {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        this.toggleFolderCollapsed(folderPath);
    }

    render(): React.ReactNode {
        return (
            <UserOptionContext.Consumer>{({ groupByFolder }) => (
                <TaskListContext.Consumer>
                    {({ taskList }) => {
                        const groupedTasks = this.groupTasksByFolder(taskList);
                        const folderPaths = groupedTasks.map(([folderPath]) => folderPath);
                        return <div className='content'>
                            {!groupByFolder && taskList.map((t) =>
                                <TaskItemView key={`${t.path}-${t.position.start.offset}-${t.position.end.offset}`} taskItem={t} />)}
                            {groupByFolder && groupedTasks.map(([folderPath, tasks]) => {
                                const folderKey = this.getFolderKey(folderPath);
                                const folderLabel = this.getFolderLabel(folderPath, folderPaths);
                                const savedCollapsed = this.props.collapseRegistry.folders.get(this.getFolderStateKey(folderPath));
                                const bulkChanged = this.props.bulkCollapseVersion !== this.state.bulkCollapseVersion;
                                const isCollapsed = bulkChanged
                                    ? this.props.bulkCollapsed
                                    : this.state.collapsedFolders[folderKey] ?? savedCollapsed ?? this.state.defaultFolderCollapsed;
                                return (
                                    <div className={isCollapsed ? "projectGroup collapsed" : "projectGroup"} key={folderKey}>
                                        <div className='projectGroupHeader' role='button' tabIndex={0}
                                            aria-expanded={!isCollapsed}
                                            aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${folderLabel}`}
                                            onClick={() => this.toggleFolderCollapsed(folderPath)}
                                            onKeyDown={(event) => this.handleFolderKeyDown(event, folderPath)}>
                                            <span className='projectGroupLabel'>
                                                <span className='icon'>{Icons.folderIcon}</span>
                                                <span className='projectGroupName' title={folderPath || "Vault root"}>{folderLabel}</span>
                                            </span>
                                        </div>
                                        {!isCollapsed && tasks.map((t) =>
                                            <TaskItemView key={`${t.path}-${t.position.start.offset}-${t.position.end.offset}`} taskItem={t} />)}
                                    </div>
                                );
                            })}
                        </div>
                    }}
                </TaskListContext.Consumer>
            )}
            </UserOptionContext.Consumer>
        )
    }
}


class TimelineControls extends React.Component {
    private searchInput;

    constructor(props: Record<string, never>) {
        super(props);
        this.searchInput = React.createRef<HTMLInputElement>();
        this.focusSearchInput = this.focusSearchInput.bind(this);
    }

    focusSearchInput(event?: React.MouseEvent<HTMLDivElement>) {
        if (event && event.target !== this.searchInput.current) {
            event.preventDefault();
        }
        this.searchInput.current?.focus();
    }

    render(): React.ReactNode {
        return (
            <UserOptionContext.Consumer>{({ controlsOpen, searchQuery, handleSearchChange }) => (
                controlsOpen &&
                <div className='controlsPanel'>
                    <div className='controlsMainRow'>
                        <div className='controlGroup'>
                            <StatusStyleToggle />
                            <FolderGroupingToggle />
                        </div>
                        <div className='taskSearch' onMouseDown={this.focusSearchInput} onClick={() => this.searchInput.current?.focus()}>
                            <span className='icon'>{Icons.searchIcon}</span>
                            <input
                                ref={this.searchInput}
                                aria-label='Search visible tasks'
                                placeholder='Search tasks'
                                type='search'
                                value={searchQuery}
                                onInput={handleSearchChange}
                            />
                        </div>
                    </div>
                    <BulkCollapseControls />
                </div>
            )}
            </UserOptionContext.Consumer>
        )
    }
}

class BulkCollapseControls extends React.Component {
    render(): React.ReactNode {
        return (
            <UserOptionContext.Consumer>{({ handleBulkCollapse }) => (
                <div className='bulkCollapseControls' aria-label='Timeline section controls'>
                    <button type='button' className='bulkCollapseAction' onClick={() => handleBulkCollapse(false)}
                        aria-label='Expand all dates and folders' title='Expand all dates and folders'>
                        <span>Expand all</span>
                    </button>
                    <button type='button' className='bulkCollapseAction' onClick={() => handleBulkCollapse(true)}
                        aria-label='Collapse all dates and folders' title='Collapse all dates and folders'>
                        <span>Collapse all</span>
                    </button>
                </div>
            )}
            </UserOptionContext.Consumer>
        );
    }
}

class StatusStyleToggle extends React.Component {
    render(): React.ReactNode {
        return (
            <TaskItemEventHandlersContext.Consumer>{({ handleToggleStatusStyle }) => (
                <UserOptionContext.Consumer>{({ useBuiltinStyle }) => {
                    const nextStyle = useBuiltinStyle ? "checkboxes" : "status icons";
                    return (
                        <button
                            type='button'
                            className={useBuiltinStyle ? "timelineToggle active" : "timelineToggle"}
                            aria-label={`Switch task status style to ${nextStyle}`}
                            title={`Switch to ${nextStyle}`}
                            onClick={handleToggleStatusStyle}>
                            {useBuiltinStyle ? Icons.taskIcon : Icons.doneIcon}
                            <span>Status style</span>
                        </button>
                    );
                }}
                </UserOptionContext.Consumer>
            )}
            </TaskItemEventHandlersContext.Consumer>
        )
    }
}

class FolderGroupingToggle extends React.Component {
    render(): React.ReactNode {
        return (
            <TaskItemEventHandlersContext.Consumer>{({ handleToggleGroupByFolder }) => (
                <UserOptionContext.Consumer>{({ groupByFolder }) => (
                    <button
                        type='button'
                        className={groupByFolder ? "timelineToggle active" : "timelineToggle"}
                        aria-label={groupByFolder ? "Stop grouping tasks by folder" : "Group tasks by folder"}
                        title={groupByFolder ? "Stop grouping by folder" : "Group by folder"}
                        onClick={handleToggleGroupByFolder}>
                        {Icons.folderIcon}
                        <span>Folders</span>
                    </button>
                )}
                </UserOptionContext.Consumer>
            )}
            </TaskItemEventHandlersContext.Consumer>
        )
    }
}

export class QuickEntry extends React.Component<Record<string, unknown>> {
    private textInput;
    private okButton;
    private quickEntryPanel;
    constructor(none: Record<string, unknown>) {
        super(none);

        this.onQuickEntryNewTaskInput = this.onQuickEntryNewTaskInput.bind(this);
        this.onQuickEntryNewTaskKeyUp = this.onQuickEntryNewTaskKeyUp.bind(this);
        this.onQuickEntryPanelBlur = this.onQuickEntryPanelBlur.bind(this);
        this.onQuickEntryPanelFocus = this.onQuickEntryPanelFocus.bind(this);
        this.focusNewTaskInput = this.focusNewTaskInput.bind(this);


        this.textInput = React.createRef<HTMLInputElement>();
        this.okButton = React.createRef<HTMLButtonElement>();
        this.quickEntryPanel = React.createRef<HTMLDivElement>();
    }

    onQuickEntryNewTaskKeyUp(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key !== "Enter") return;
        this.okButton.current?.click();
    }

    onQuickEntryNewTaskInput() {
        const input = this.textInput.current;
        if (!input) return;
        const newTask = input.value;
        // Icons
        if (newTask.includes("due ")) { input.value = newTask.replace("due", dueDateSymbol) }
        if (newTask.includes("start ")) { input.value = newTask.replace("start", startDateSymbol) }
        if (newTask.includes("scheduled ")) { input.value = newTask.replace("scheduled", scheduledDateSymbol) }
        if (newTask.includes("done ")) { input.value = newTask.replace("done", doneDateSymbol) }
        if (newTask.includes("repeat ")) { input.value = newTask.replace("repeat", recurrenceSymbol) }
        if (newTask.includes("recurring ")) { input.value = newTask.replace("recurring", recurrenceSymbol) }

        // Dates
        if (newTask.includes("today ")) { input.value = newTask.replace("today", moment().format("YYYY-MM-DD")) }
        if (newTask.includes("tomorrow ")) { input.value = newTask.replace("tomorrow", moment().add(1, "days").format("YYYY-MM-DD")) }
        if (newTask.includes("yesterday ")) { input.value = newTask.replace("yesterday", moment().subtract(1, "days").format("YYYY-MM-DD")) }

        // In X days/weeks/month/years
        const futureDate = newTask.match(/(in)\W(\d{1,3})\W(days|day|weeks|week|month|years|year) /);
        if (futureDate && futureDate.length > 3) {
            const value: number = parseInt(futureDate[2]);
            const unit = futureDate[3] as moment.unitOfTime.Base;
            const date = moment().add(value, unit).format("YYYY-MM-DD[ ]")
            input.value = newTask.replace(futureDate[0], date);
        }

        // Next Weekday
        const weekday = newTask.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday) /);
        if (weekday) {
            const weekdays = ["", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
            const dayINeed = weekdays.indexOf(weekday[1]);
            if (moment().isoWeekday() < dayINeed) {
                input.value = newTask.replace(weekday[1], moment().isoWeekday(dayINeed).format("YYYY-MM-DD"));
            } else {
                input.value = newTask.replace(weekday[1], moment().add(1, 'weeks').isoWeekday(dayINeed).format("YYYY-MM-DD"));
            }
        }

        input.focus();
    }

    onQuickEntryPanelFocus() {
        this.quickEntryPanel.current?.addClass("focus");
    }

    onQuickEntryPanelBlur() {
        this.quickEntryPanel.current?.removeClass("focus");
    }

    focusNewTaskInput() {
        window.setTimeout(() => {
            this.textInput.current?.focus();
        }, 0);
    }

    render(): React.ReactNode {
        return (
            <div className='quickEntryPanel' ref={this.quickEntryPanel}>
                <div className='left'>
                    <div className='quickEntryBody'>
                        <div className='quickEntryInputs'>
                            <input className='newTask' type='text' placeholder='Enter your tasks here' ref={this.textInput}
                                onInput={this.onQuickEntryNewTaskInput} onKeyUp={this.onQuickEntryNewTaskKeyUp}
                                onFocus={this.onQuickEntryPanelFocus} onBlur={this.onQuickEntryPanelBlur} />
                        </div>
                    </div>
                </div>

                <div className='right'>
                    <UserOptionContext.Consumer>{({ select }) => (
                        <QuickEntryHandlerContext.Consumer>{callback => (
                            <button className='ok' ref={this.okButton} aria-label='Add task to default note'
                                onClick={async () => {
                                    const filePath = select;
                                    const newTask = this.textInput.current?.value;
                                    if (!newTask || !filePath) return;
                                    if (newTask.length > 1) {
                                        await callback.handleCreateNewTask(filePath, newTask);
                                        if (this.textInput.current) {
                                            this.textInput.current.value = "";
                                        }
                                        this.focusNewTaskInput();
                                    } else {
                                        this.focusNewTaskInput();
                                    }
                                }}>
                                {Icons.addIcon}
                            </button>)}
                        </QuickEntryHandlerContext.Consumer>
                    )}
                    </UserOptionContext.Consumer>
                </div>
            </div >
        );
    }
}

const defaultTodayFocusProps = {
    visual: "Today" as string,
};
type TodayFocusProps = Readonly<typeof defaultTodayFocusProps>;
class TodayFocus extends React.Component<TodayFocusProps> {
    render(): React.ReactNode {
        return (
            <TodayFocusEventHandlersContext.Consumer>{callback => (
                <button type='button' className='todayHeader' aria-label='Focus today' onClick={callback.handleTodayFocusClick}>
                    {this.props.visual}
                </button>)}
            </TodayFocusEventHandlersContext.Consumer>
        );
    }
}

const defaultCountersProps = {
}

type CountersProps = Readonly<typeof defaultCountersProps>;

class Counters extends React.Component<CountersProps> {
    render(): React.ReactNode {
        return (
            <UserOptionContext.Consumer>{options => (
                < div className='counters' >
                    {options.counters.map((c, i) =>
                        <CounterItem onClick={c.onClick} cnt={c.cnt} id={c.id} label={c.label} ariaLabel={c.ariaLabel} key={i} />
                    )}
                </div>
            )}
            </UserOptionContext.Consumer>
        );
    }
}

const defaultCounterProps = {
    onClick: () => { },
    cnt: 0,
    id: "",
    label: "",
    ariaLabel: ""
}

export type CounterProps = Readonly<typeof defaultCounterProps>;

class CounterItem extends React.Component<CounterProps> {
    render(): React.ReactNode {
        return (<button type='button' className='counter' id={this.props.id} aria-label={this.props.ariaLabel} onClick={this.props.onClick}>
            <div className='count'>{this.props.id === "controls" ? Icons.controlsIcon : this.props.cnt}</div>
            <div className='label'>{this.props.label}</div>
        </button>
        );
    }
}
