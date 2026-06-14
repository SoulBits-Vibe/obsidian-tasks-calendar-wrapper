import moment from 'moment';
import * as React from 'react';
import { TaskDataModel, doneDateSymbol, dueDateSymbol, recurrenceSymbol, scheduledDateSymbol, startDateSymbol } from '../../../utils/tasks';
import * as Icons from './asserts/icons';
import { QuickEntryHandlerContext, TaskItemEventHandlersContext, TaskListContext, TodayFocusEventHandlersContext, UserOptionContext } from './context';
import { TaskItemView } from './taskitemview';

const defaultDateProps = {
    date: moment(),
}

type DateViewProps = Readonly<typeof defaultDateProps>;
type DateViewState = {
    collapsed: boolean,
};

export class DateView extends React.Component<DateViewProps, DateViewState> {
    constructor(props: DateViewProps) {
        super(props);
        this.state = { collapsed: false };
        this.toggleCollapsed = this.toggleCollapsed.bind(this);
    }

    toggleCollapsed() {
        this.setState({ collapsed: !this.state.collapsed });
    }

    render(): React.ReactNode {
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
                                        collapsed={this.state.collapsed}
                                        onToggle={this.toggleCollapsed} />
                                    {!this.state.collapsed && <div className={isToday ? "details today" : "details"}
                                        data-year={this.props.date.format("YYYY")}
                                        data-types={[...new Set(taskList.map((t => t.status)))].join(" ")}>
                                        <TaskListContext.Provider value={{ taskList: taskList, entryOnDate: entryOnDate }}>
                                            <NormalDateContent date={this.props.date} />
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
};

export class NoDateView extends React.Component<Record<string, never>, NoDateViewState> {
    constructor(props: Record<string, never>) {
        super(props);
        this.state = { collapsed: false };
        this.toggleCollapsed = this.toggleCollapsed.bind(this);
    }

    toggleCollapsed() {
        this.setState({ collapsed: !this.state.collapsed });
    }

    render(): React.ReactNode {
        return (
            <TaskListContext.Consumer>{({ taskList, entryOnDate }) => (
                taskList.length > 0 &&
                <div className="details noDateDetails" data-types={[...new Set(taskList.map((t => t.status)))].join(" ") + " unplanned"}>
                    <DateHeader
                        thisDate="Unplanned / No Date"
                        taskCount={taskList.length}
                        collapsed={this.state.collapsed}
                        onToggle={this.toggleCollapsed} />
                    {!this.state.collapsed &&
                        <div className="details noDateDetails" data-types={[...new Set(taskList.map((t => t.status)))].join(" ") + " unplanned"}>
                            <TaskListContext.Provider value={{ taskList: taskList, entryOnDate: entryOnDate }}>
                                <NormalDateContent date={moment.invalid()} />
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
                <span className='collapseIcon'>{this.props.collapsed ? ">" : "v"}</span>
                <div className='date'>{this.props.thisDate}</div>
                <div className='dateCount'>{this.props.taskCount}</div>
                <div className='weekday'></div>
            </div>
        )
    }
}

type NormalDateContentProps = {
    date: moment.Moment,
}

type NormalDateContentState = {
    collapsedFolders: Record<string, boolean>,
}

class NormalDateContent extends React.Component<NormalDateContentProps, NormalDateContentState> {
    constructor(props: NormalDateContentProps) {
        super(props);
        this.state = { collapsedFolders: {} };
        this.toggleFolderCollapsed = this.toggleFolderCollapsed.bind(this);
    }

    getFolderName(path: string) {
        const pathParts = path.split('/').filter(part => part.length > 0);
        if (pathParts.length <= 1) return "";
        return pathParts[pathParts.length - 2];
    }

    groupTasksByFolder(taskList: TaskDataModel[]) {
        const groupedTasks = new Map<string, TaskDataModel[]>();
        taskList.forEach(task => {
            const folderName = this.getFolderName(task.path);
            const tasks = groupedTasks.get(folderName) || [];
            tasks.push(task);
            groupedTasks.set(folderName, tasks);
        });
        return [...groupedTasks.entries()].sort(([folderA], [folderB]) => folderA.localeCompare(folderB));
    }

    getFolderKey(folderName: string) {
        return folderName || "vault-root";
    }

    toggleFolderCollapsed(folderName: string) {
        const folderKey = this.getFolderKey(folderName);
        this.setState({
            collapsedFolders: {
                ...this.state.collapsedFolders,
                [folderKey]: !this.state.collapsedFolders[folderKey],
            }
        });
    }

    handleFolderKeyDown(event: React.KeyboardEvent<HTMLDivElement>, folderName: string) {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        this.toggleFolderCollapsed(folderName);
    }

    render(): React.ReactNode {
        return (
            <UserOptionContext.Consumer>{({ groupByFolder }) => (
                <TaskListContext.Consumer>
                    {({ taskList }) => (
                        <div className='content'>
                            {!groupByFolder && taskList.map((t) =>
                                <TaskItemView key={`${t.path}-${t.position.start.offset}-${t.position.end.offset}`} taskItem={t} />)}
                            {groupByFolder && this.groupTasksByFolder(taskList).map(([folderName, tasks]) => {
                                const folderKey = this.getFolderKey(folderName);
                                const isCollapsed = Boolean(this.state.collapsedFolders[folderKey]);
                                return (
                                    <div className={isCollapsed ? "projectGroup collapsed" : "projectGroup"} key={folderKey}>
                                        <div className='projectGroupHeader' role='button' tabIndex={0}
                                            aria-expanded={!isCollapsed}
                                            aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${folderName || "Vault root"}`}
                                            onClick={() => this.toggleFolderCollapsed(folderName)}
                                            onKeyDown={(event) => this.handleFolderKeyDown(event, folderName)}>
                                            <span className='projectGroupLabel'>
                                                <span className='projectGroupFoldIcon'>{isCollapsed ? ">" : "v"}</span>
                                                <span className='icon'>{Icons.folderIcon}</span>
                                                <span className='projectGroupName'>{folderName || "Vault root"}</span>
                                            </span>
                                        </div>
                                        {!isCollapsed && tasks.map((t) =>
                                            <TaskItemView key={`${t.path}-${t.position.start.offset}-${t.position.end.offset}`} taskItem={t} />)}
                                    </div>
                                );
                            })}
                        </div>
                    )}
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
                            onChange={handleSearchChange}
                        />
                    </div>
                </div>
            )}
            </UserOptionContext.Consumer>
        )
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

class QuickEntry extends React.Component<Record<string, unknown>> {
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
                <div className='todayHeader' aria-label='Focus today' onClick={callback.handleTodayFocusClick}>
                    {this.props.visual}
                </div>)}
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
        return (<div className='counter' id={this.props.id} aria-label={this.props.ariaLabel} onClick={this.props.onClick}>
            <div className='count'>{this.props.id === "controls" ? Icons.controlsIcon : this.props.cnt}</div>
            <div className='label'>{this.props.label}</div>
        </div>
        );
    }
}
