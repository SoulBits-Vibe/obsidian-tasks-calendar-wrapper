import { Model } from 'backbone';
import { App, ItemView, moment, Notice, normalizePath, Pos } from 'obsidian';
import * as React from 'react';
import { UserOption, defaultUserOptions } from '../../src/settings';
import { TaskDataModel, TaskStatus, TaskStatusMarkerMap } from '../../utils/tasks';
import { toggleTaskInContent } from '../../utils/tasktoggle';
import { QuickEntryHandlerContext, TaskItemEventHandlersContext } from './components/context';
import { TimelineView } from './components/timelineview';

const defaultObsidianBridgeProps = {
    plugin: {} as ItemView,
    userOptionModel: new Model({ ...defaultUserOptions }) as Model,
    taskListModel: new Model({ taskList: [] as TaskDataModel[] }) as Model,
}
const defaultObsidianBridgeState = {
    taskList: [] as TaskDataModel[],
    userOptions: defaultUserOptions as UserOption,
}
type ObsidianBridgeProps = Readonly<typeof defaultObsidianBridgeProps>;
type ObsidianBridgeState = typeof defaultObsidianBridgeState;
export class ObsidianBridge extends React.Component<ObsidianBridgeProps, ObsidianBridgeState> {
    //private readonly adapter: ObsidianTaskAdapter;
    private readonly app: App;
    constructor(props: ObsidianBridgeProps) {
        super(props);

        this.app = this.props.plugin.app;

        this.handleCreateNewTask = this.handleCreateNewTask.bind(this);
        this.handleTagClick = this.handleTagClick.bind(this);
        this.handleOpenFile = this.handleOpenFile.bind(this);
        this.handleCompleteTask = this.handleCompleteTask.bind(this);
        this.handleToggleStatusStyle = this.handleToggleStatusStyle.bind(this);
        this.handleToggleGroupByFolder = this.handleToggleGroupByFolder.bind(this);
        this.onUpdateTasks = this.onUpdateTasks.bind(this);
        this.onUpdateUserOption = this.onUpdateUserOption.bind(this);
        this.handleModifyTask = this.handleModifyTask.bind(this);

        //this.adapter = new ObsidianTaskAdapter(this.app);

        this.state = {
            userOptions: { ...(this.props.userOptionModel.pick(this.props.userOptionModel.keys()) as UserOption) },
            taskList: this.props.taskListModel.get("taskList"),
        }
    }

    componentDidMount(): void {

        this.props.taskListModel.on('change', this.onUpdateTasks)
        this.props.userOptionModel.on('change', this.onUpdateUserOption)
    }

    componentWillUnmount(): void {
        this.props.taskListModel.off('change', this.onUpdateTasks);
        this.props.userOptionModel.off('change', this.onUpdateUserOption);
    }

    onUpdateUserOption() {
        this.setState({
            userOptions: { ...(this.props.userOptionModel.pick(this.props.userOptionModel.keys()) as UserOption) }
        })
    }

    onUpdateTasks() {
        this.setState({
            taskList: this.props.taskListModel.get("taskList"),
        })
    }

    async ensureParentFolders(path: string) {
        const parts = normalizePath(path).split('/');
        parts.pop();
        let currentPath = "";
        for (const part of parts) {
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            if (!(await this.app.vault.adapter.exists(currentPath))) {
                await this.app.vault.createFolder(currentPath);
            }
        }
    }

    insertTaskInSection(content: string, section: string, taskStr: string) {
        const lines = content.split('\n');
        const sectionIndex = lines.indexOf(section);
        if (sectionIndex === -1) {
            const needsSeparator = lines.length > 0 && lines.some(line => line.trim().length > 0);
            return `${content}${needsSeparator ? "\n\n" : ""}${section}\n${taskStr}`;
        }
        lines.splice(sectionIndex + 1, 0, taskStr);
        return lines.join("\n");
    }

    async handleCreateNewTask(path: string, append: string) {
        const taskStr = "- [ ] " + append;
        const section = this.state.userOptions.sectionForNewTasks;
        const normalizedPath = normalizePath(path);
        try {
            const exists = await this.app.vault.adapter.exists(normalizedPath);
            if (!exists) {
                await this.ensureParentFolders(normalizedPath);
                await this.app.vault.create(normalizedPath, section + "\n" + taskStr);
                new Notice("Created " + normalizedPath, 3000);
                this.onUpdateTasks();
                return;
            }
            const content = await this.app.vault.adapter.read(normalizedPath);
            await this.app.vault.adapter.write(normalizedPath, this.insertTaskInSection(content, section, taskStr));
            this.onUpdateTasks();
        } catch (reason) {
            new Notice("Error when writing new task to " + normalizedPath + ": " + reason, 5000);
        }
    }


    handleTagClick(tag: string) {
        //@ts-ignore
        const searchPlugin = this.app.internalPlugins.getPluginById("global-search");
        const search = searchPlugin && searchPlugin.instance;
        search.openGlobalSearch('tag:' + tag)
    }

    private focusTaskInEditor(position: Pos) {
        const editor = this.app.workspace.activeEditor?.editor;
        if (!editor) return;

        const from = { line: position.start.line, ch: position.start.col };
        const to = { line: position.end.line, ch: position.end.col };
        editor.setSelection(from, to);
        editor.scrollIntoView({ from, to }, true);
        if (!editor.hasFocus()) editor.focus();
    }

    private settleTaskFocus(position: Pos) {
        this.focusTaskInEditor(position);
        window.setTimeout(() => this.focusTaskInEditor(position), 80);
    }

    handleOpenFile(path: string, position: Pos, openTaskEdit = false) {
        this.app.vault.adapter.exists(path).then(exist => {
            if (!exist) {
                new Notice("No such file: " + path, 5000);
                return;
            }
            this.app.workspace.openLinkText('', path).then(async () => {
                try {
                    const file = this.app.workspace.getActiveFile();
                    file && await this.app.workspace.getLeaf().openFile(file, { state: { mode: "source" } });
                    this.settleTaskFocus(position);
                    if (openTaskEdit) {
                        window.setTimeout(() => {
                            const editor = this.app.workspace.activeEditor?.editor;
                            if (!editor) return;
                            const view = this.app.workspace.getLeaf().view;
                            //@ts-ignore
                            this.app.commands.commands['obsidian-tasks-plugin:edit-task']
                                .editorCheckCallback(false, editor, view);
                        }, 100);
                    }
                } catch (err) {
                    new Notice("Error when trying open file: " + err, 5000);
                }
            })
        }).catch(reason => {
            new Notice("Something went wrong: " + reason, 5000);
        })
    }

    handleModifyTask(path: string, position: Pos) {
        this.handleOpenFile(path, position, true);
    }

    async handleToggleStatusStyle() {
        const useBuiltinStyle = !this.state.userOptions.useBuiltinStyle;
        await this.updateDisplayOption({ useBuiltinStyle });
    }

    async handleToggleGroupByFolder() {
        const groupByFolder = !this.state.userOptions.groupByFolder;
        await this.updateDisplayOption({ groupByFolder });
    }

    async updateDisplayOption(update: Partial<UserOption>) {
        this.props.userOptionModel.set(update);
        const wrapperPlugin = (this.app as any).plugins?.plugins?.["tasks-calendar-wrapper"];
        if (wrapperPlugin?.userOptions && wrapperPlugin?.saveData) {
            wrapperPlugin.userOptions = {
                ...wrapperPlugin.userOptions,
                ...update,
            };
            await wrapperPlugin.saveData({ ...wrapperPlugin.userOptions });
        }
    }

    hideTaskAfterCompleteToggle(path: string, position: Pos) {
        const hideStatusTasks = this.state.userOptions.hideStatusTasks || [];
        const hidesDone = hideStatusTasks.includes("x") ||
            hideStatusTasks.some(marker => TaskStatusMarkerMap[marker as keyof typeof TaskStatusMarkerMap] === TaskStatus.done);
        if (!hidesDone) return;
        const taskList: TaskDataModel[] = this.props.taskListModel.get("taskList");
        this.props.taskListModel.set({
            taskList: taskList.filter(task =>
                task.path !== path ||
                task.position.start.line !== position.start.line ||
                task.position.start.col !== position.start.col)
        });
    }

    reloadTasksSoon(delay = 80) {
        window.setTimeout(() => {
            //@ts-ignore
            this.props.plugin.onReloadTasks?.();
        }, delay);
    }

    async handleCompleteTaskViaTasksPlugin(path: string, position: Pos) {
        await this.app.workspace.openLinkText('', path);
        const file = this.app.workspace.getActiveFile();
        await this.app.workspace.getLeaf().openFile(file!, { state: { mode: "source" } });
        this.settleTaskFocus(position);
        const editor = this.app.workspace.activeEditor?.editor;
        if (!editor) return;

        const view = this.app.workspace.getLeaf().view;
        //@ts-ignore
        this.app.commands.commands['obsidian-tasks-plugin:toggle-done']
            .editorCheckCallback(false, editor, view);
        this.reloadTasksSoon(300);
    }

    async handleCompleteTask(path: string, position: Pos) {
        this.hideTaskAfterCompleteToggle(path, position);
        try {
            const content = await this.app.vault.adapter.read(path);
            const sourceLine = content.split(/\r?\n/)[position.start.line] || "";
            if (sourceLine.includes("🔁")) {
                await this.handleCompleteTaskViaTasksPlugin(path, position);
                return;
            }

            const updatedContent = toggleTaskInContent(content, position.start.line, moment().format("YYYY-MM-DD"));
            await this.app.vault.adapter.write(path, updatedContent);
            this.reloadTasksSoon();
        } catch (reason) {
            new Notice("Fast task toggle failed; falling back to Tasks command.", 3000);
            await this.handleCompleteTaskViaTasksPlugin(path, position);
        }
    }

    render(): React.ReactNode {
        return (
            <QuickEntryHandlerContext.Provider
                value={{
                    handleCreateNewTask: this.handleCreateNewTask,
                }}>
                <TaskItemEventHandlersContext.Provider value={{
                    handleOpenFile: this.handleOpenFile,
                    handleCompleteTask: this.handleCompleteTask,
                    handleTagClick: this.handleTagClick,
                    // pass an undefined if the obsidian-tasks-plugin not installed
                    //@ts-ignore
                    handleModifyTask: this.app.plugins.plugins['obsidian-tasks-plugin'] === undefined ? undefined : this.handleModifyTask,
                    //@ts-ignore
                    handleToggleStatusStyle: this.handleToggleStatusStyle,
                    handleToggleGroupByFolder: this.handleToggleGroupByFolder,
                }}>
                    <TimelineView userOptions={this.state.userOptions} taskList={this.state.taskList} />
                </TaskItemEventHandlersContext.Provider>
            </QuickEntryHandlerContext.Provider>
        )
    }
}
