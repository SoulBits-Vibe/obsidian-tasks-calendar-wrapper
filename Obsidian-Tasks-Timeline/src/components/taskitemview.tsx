import moment, { Moment } from "moment";
import { MarkdownRenderer } from "obsidian";
import * as React from "react";
import { getFileTitle } from "../../../dataview-util/dataview";
import { TasksTimelineView } from "../../../src/views";
import { internalLinkTextFromTarget, shouldOpenTaskRowFromTarget } from "../../../utils/taskiteminteractions";
import { TaskDataModel, TaskStatus, recurrenceSymbol } from "../../../utils/tasks";
import * as Icons from './asserts/icons';
import { TaskItemEventHandlersContext, UserOptionContext } from "./context";

const getRelative = (someDate: Moment) => {
    const today = moment().startOf('day');
    const targetDate = someDate.clone().startOf('day');
    const dayDiff = targetDate.diff(today, 'days');
    if (dayDiff >= 1 || dayDiff <= -1) {
        return targetDate.from(today);
    } else {
        return someDate.calendar().split(' ')[0];
    }
};

const defaultTaskItemProps = {
    taskItem: {} as TaskDataModel
}

type TaskItemProps = Readonly<typeof defaultTaskItemProps>;
const defaultTaskItemState = {
    taskStatus: "task" as string,
}
type TaskItemState = typeof defaultTaskItemState;

const priorityClass = (priority: string) =>
    `priority priority-${priority.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

export class TaskItemView extends React.Component<TaskItemProps, TaskItemState> {
    constructor(props: TaskItemProps) {
        super(props);
        this.state = {
            taskStatus: "task",
        }
    }

    render(): React.ReactNode {
        const item = this.props.taskItem;
        const display = item.visual || item.text;
        const line = item.line;
        const col = item.position.end.col;
        const link = item.link.path.replace("'", "&apos;");
        const isDailyNote = item.dailyNote;
        const color = item.fontMatter["color"];
        const ariaLabel = getFileTitle(item.path);
        const tags = [...new Set(item.tags)];
        //const outlinks = item.outlinks;

        const path = item.path;
        const position = item.position;
        const statusInputId = `status-marker-${path.replace(/[^a-zA-Z0-9_-]/g, "-")}-${line}`;
        return (
            <TaskItemEventHandlersContext.Consumer>{
                callbacks => {
                    const openTaskFile = () => {
                        callbacks.handleOpenFile(path, position);
                    };
                    const openTaskFileFromRow = (event: React.MouseEvent<HTMLElement>) => {
                        if (shouldOpenTaskRowFromTarget(event.target as Element)) openTaskFile();
                    };
                    const onToggleTask = () => {
                        callbacks.handleCompleteTask(path, position);
                    };
                    const onModifyTask = () => {
                        callbacks.handleModifyTask(path, position);
                    };
                    return (
                        <UserOptionContext.Consumer>{
                            ({ dateFormat, hideTags, useBuiltinStyle }) =>
                            (<div data-line={line} data-task={item.statusMarker} data-col={col} data-link={link} data-dailynote={isDailyNote}
                                className={`task ${item.status}`}
                                style={{ "--task-color": color || "var(--text-muted)" } as React.CSSProperties} aria-label={ariaLabel}>
                                <StripWithIcon inputId={statusInputId} onToggle={onToggleTask} useBuiltinStyle={useBuiltinStyle}
                                    marker={item.statusMarker} status={item.status} />
                                <div className='lines' onClick={openTaskFileFromRow}>
                                    <div className="content">
                                        <Content display={display} fileName={item.path} />
                                    </div>
                                    <div className='line info'>
                                        {callbacks.handleModifyTask &&
                                            <ModifyBadge onClick={onModifyTask}></ModifyBadge>}
                                        {item.created &&
                                            <DateStatusBadge //onClick={openTaskFile}
                                                className='relative' ariaLabel={"create at " + item.created.format(dateFormat)}
                                                label={getRelative(item.created)} icon={Icons.taskIcon} />}
                                        {item.start &&
                                            <DateStatusBadge //onClick={openTaskFile}
                                                className='relative' ariaLabel={"start at " + item.start.format(dateFormat)}
                                                label={getRelative(item.start)} icon={Icons.startIcon} />}
                                        {item.scheduled &&
                                            <DateStatusBadge //onClick={openTaskFile}
                                                className='relative' ariaLabel={"scheduled to " + item.scheduled.format(dateFormat)}
                                                label={getRelative(item.scheduled)} icon={Icons.scheduledIcon} />}
                                        {item.due &&
                                            <DateStatusBadge //onClick={openTaskFile}
                                                className='relative' ariaLabel={"due at " + item.due.format(dateFormat)}
                                                label={getRelative(item.due)} icon={Icons.dueIcon} />}
                                        {item.completion &&
                                            <DateStatusBadge //onClick={openTaskFile}
                                                className='relative' ariaLabel={"complete at " + item.completion.format(dateFormat)}
                                                label={getRelative(item.completion)} icon={Icons.doneIcon} />}

                                        {item.recurrence &&
                                            <DateStatusBadge //onClick={openTaskFile}
                                                className='repeat' ariaLabel={'recurrent: ' + item.recurrence.replace(recurrenceSymbol, '')}
                                                label={item.recurrence.replace(recurrenceSymbol, '')} icon={Icons.repeatIcon} />}

                                        {item.priority &&
                                            <DateStatusBadge //onClick={openTaskFile}
                                                className={priorityClass(item.priority)} ariaLabel={'priority: ' + item.priority}
                                                label={item.priority.length > 0 ? item.priority + " Priority" : "No Priority"}
                                                icon={Icons.priorityIcon} />}
                                        {item.dateWarnings && item.dateWarnings.length > 0 &&
                                            <DateStatusBadge
                                                className='dateWarning'
                                                ariaLabel={'Invalid date: ' + item.dateWarnings.map(w => `${w.field} ${w.value}`).join(', ')}
                                                label={item.dateWarnings.length === 1 ? "Invalid date" : `${item.dateWarnings.length} invalid dates`}
                                                icon={Icons.alertIcon} />}
                                        <FileBadge filePath={item.path} subPath={item.section.subpath || ""} />
                                        {[...new Set(tags)].filter(t => !hideTags.includes(t)).map((t, i) => {
                                            return < TagBadge tag={t} key={i} />
                                        }
                                        )}
                                    </div>
                                </div>
                            </div>)}
                        </UserOptionContext.Consumer>
                    )
                }}
            </TaskItemEventHandlersContext.Consumer>
        )
    }
}

const defaultContentProps = {
    display: "",
    fileName: "",
}
type ContentProps = Readonly<typeof defaultContentProps>
class Content extends React.Component<ContentProps> {
    handleClick(event: React.MouseEvent<HTMLSpanElement>) {
        const target = event.target as Element;
        const internalLinkText = internalLinkTextFromTarget(target);
        if (internalLinkText) {
            event.preventDefault();
            event.stopPropagation();
            TasksTimelineView.view?.app.workspace.openLinkText(internalLinkText, this.props.fileName);
            return;
        }
        if (target.closest(".external-link")) {
            event.stopPropagation();
        }
    }

    render(): React.ReactNode {
        const cont = createEl("span")
        MarkdownRenderer.renderMarkdown(this.props.display, cont, this.props.fileName, TasksTimelineView.view!);
        return <span className="taskContentMarkdown" onClick={(event) => this.handleClick(event)}
            dangerouslySetInnerHTML={{ __html: cont.firstElementChild?.innerHTML || "" }} />
    }
}


const defaultStripWithIconProps = {
    inputId: "",
    status: "task",
    marker: " ",
    useBuiltinStyle: true,
    onToggle: () => { },
}

type StripWithIconProps = Readonly<typeof defaultStripWithIconProps>
class StripWithIcon extends React.Component<StripWithIconProps> {

    render(): React.ReactNode {
        return (
            <div className='timeline' >
                <input id={this.props.inputId} type="checkbox" className={this.props.useBuiltinStyle ? "icon" : ""}
                    data-task={this.props.marker}
                    defaultChecked={this.props.status === TaskStatus.done} onClick={() => {
                        if (!this.props.useBuiltinStyle) this.props.onToggle();
                    }}></input>
                {this.props.useBuiltinStyle &&
                    <label htmlFor={this.props.inputId} className="icon" onClick={() => {
                        if (this.props.useBuiltinStyle) this.props.onToggle();
                    }}>{Icons.getTaskStatusIcon(this.props.status)}</label>}
            </div>
        )
    }
}

const defaultTagBadgeProps = {
    tag: "",
};

type TagBadgeProps = Readonly<typeof defaultTagBadgeProps>;

class TagBadge extends React.Component<TagBadgeProps> {

    render(): React.ReactNode {
        return (
            <UserOptionContext.Consumer>{({ tagPalette }) => {
                const tag = this.props.tag;
                const tagText = tag.replace("#", "");
                let color;
                const normalizedTag = tag.startsWith("#") ? tag.toLowerCase() : `#${tag.toLowerCase()}`;
                const paletteEntry = Object.entries(tagPalette)
                    .find(([paletteTag]) => {
                        const normalizedPaletteTag = paletteTag.startsWith("#") ?
                            paletteTag.toLowerCase() : `#${paletteTag.toLowerCase()}`;
                        return normalizedPaletteTag === normalizedTag;
                    });
                if (paletteEntry) color = paletteEntry[1];
                let style: Record<string, unknown>;
                if (color) {
                    style = {
                        '--tag-color': color,
                        '--tag-background': `${color}1a`,
                        'color': color,
                        'zIndex': 9999,
                    };
                } else {
                    style = {
                        '--tag-color': 'var(--text-muted)',
                        'zIndex': 9999,
                    };
                }
                return (
                    <TaskItemEventHandlersContext.Consumer>{callbacks => (
                        <a href={tag} className={'tag'} target='_blank' rel='noopener' style={style} aria-label={tag}
                            onClick={(e) => {
                                e.stopPropagation();
                                callbacks.handleTagClick(tag);
                            }}>
                            <div className='icon'>{Icons.tagIcon}</div>
                            <div className='label'>{tagText}</div>
                        </a>)}
                    </TaskItemEventHandlersContext.Consumer>)
            }}
            </UserOptionContext.Consumer>
        );
    }
}

const defaultFileBadgeProps = {
    filePath: "",
    subPath: "",
}

type FileBadgeProps = Readonly<typeof defaultFileBadgeProps>;
class FileBadge extends React.Component<FileBadgeProps> {
    render(): React.ReactNode {
        const filePath = this.props.filePath;
        const fileName = getFileTitle(filePath);
        const subPath = this.props.subPath;
        return (
            <a className='file' aria-label={filePath}>
                <div className='icon'>{Icons.fileIcon}</div>
                <div className='label'>{fileName}</div>
                <span className='header'>{subPath != "" ? "  >  " + subPath : subPath}</span>
            </a>)
    }
}

const defaultBadgeProps = {
    className: "",
    ariaLabel: "",
    label: "",
    icon: Icons.taskIcon,
    //onClick: () => { },
}

type BadgeProps = Readonly<typeof defaultBadgeProps>;

class DateStatusBadge extends React.Component<BadgeProps> {

    render(): React.ReactNode {
        const type = this.props.className;
        const aria_label = this.props.ariaLabel;
        const label = this.props.label;
        const icon = this.props.icon;
        return (
            <a className={type} aria-label={aria_label} /*onClick={this.props.onClick}*/>
                <div className='icon'>{icon}</div>
                <div className='label'>{label}</div>
            </a>
        );
    }
}

const defaultModifyBadgeProps = {
    onClick: () => { }
};
type ModifyBadgeProps = Readonly<typeof defaultModifyBadgeProps>;
class ModifyBadge extends React.Component<ModifyBadgeProps> {
    render(): React.ReactNode {
        return (
            <a aria-label="Modify Task" onClick={(event) => {
                event.stopPropagation();
                this.props.onClick();
            }}>✏️</a>
        )
    }
}
