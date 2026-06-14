import { App, Modal, Notice, Plugin, PluginSettingTab, Setting } from "obsidian";
import { TaskRegularExpressions } from "utils/tasks";
import TasksCalendarWrapper from "./main";
const sortOptions = {
    "(t1, t2) => t1.order <= t2.order ? -1 : 1": "Status order",
    "(t1, t2) => t1.order >= t2.order ? -1 : 1": "Reverse status order",
    "(t1, t2) => t1.visual.trim() <= t2.visual.trim() ? -1 : 1": "Task text A to Z",
    "(t1, t2) => t1.visual.trim() >= t2.visual.trim() ? -1 : 1": "Task text Z to A",
    "(t1, t2) => t1.start <= t2.start ? -1 : 1": "Start date oldest first",
    "(t1, t2) => t1.start >= t2.start ? -1 : 1": "Start date newest first",
    "(t1, t2) => t1.due <= t2.due ? -1 : 1": "Due date oldest first",
    "(t1, t2) => t1.due >= t2.due ? -1 : 1": "Due date newest first",
    "(t1, t2) => t1.tags <= t2.tags ? -1 : 1": "Tags A to Z",
    "(t1, t2) => t1.tags >= t2.tags ? -1 : 1": "Tags Z to A"
};

const splitCommaList = (value: string) => value
    .split(',')
    .map(p => p.trim())
    .filter(p => p.length > 0);

const normalizeTagText = (tag: string) => {
    const trimmedTag = tag.trim();
    return trimmedTag.startsWith("#") ? trimmedTag : `#${trimmedTag}`;
};

export const defaultUserOptions = {
    /**
	 * Open the view on startup or not
	 */
	openViewOnStartup: false as boolean,
    /**
     * filter empty items out or not, if not, the raw text of empty items will be displayed
     */
    filterEmpty: true as boolean,
    /**
     * Exclude tasks match specific paths (folders, files)
     */
    excludePaths: [] as string[],
    /**
     * filter specific files and tasks only from these files are rendered */
    includePaths: [] as string[],
    /**
     * Use tags filters to filter tasks without specific tags out or not.
     */
    useIncludeTags: false as boolean,
    /**
     * Filter tasks with specific tags, only tasks with one or more of these tags are displayed.
     */
    taskIncludeTags: [] as string[],
    /**
     * Filter tasks in specific files which contains one or more of these tags to be displayed.
     */
    fileIncludeTags: [] as string[],
    /**
     * Use tags filters to filters tasks with specific tags out or not.
     */
    useExcludeTags: false as boolean,
    /**
     * Filter tasks without specific tags, only tasks **without any** if these tags are displayed.
     */
    taskExcludeTags: [] as string[],
    /**
     * Filter tasks in specific files which **does not** contains any of these tags to be displayed.
     */
    fileExcludeTags: [] as string[],
    /**
     * optional options to customize the look */
    styles: ['style1'] as string[],
    /**
     * specify the folder where the daily notes are saved */
    dailyNoteFolder: '' as string,
    /**
     * daily note file format */
    dailyNoteFormat: 'YYYY, MMMM DD - dddd' as string,
    /**
     * specify under which section the new task items should be appended.  */
    sectionForNewTasks: "## Tasks" as string,
    /**
     * specify which tags are not necessary to display with a tag badge,
     * note that all tag texts are remove from the displayed item text by default. */
    hideTags: [] as string[],
    /**
     * Forward tasks from the past and display them on the today panel or not
     */
    forward: true as boolean,
    /**
     * Specify how do you like the task item to be sorted, it must be a valid lambda
     */
    sort: "(t1, t2) => t1.order <= t2.order ? -1 : 1" as string,
    /**
     * Specify task status order
     * TODO
     */
    taskStatusOrder: ["overdue", "due", "scheduled", "start", "process", "unplanned", "done", "cancelled"],
    /**
     * Specify in what format do you like the dates to be displayed.
     */
    dateFormat: "dddd, MMM, D" as string,
    /**
     * Specify in which file do you like to append new task items to by default.
     * Tasks from this file will be displayed under today panel and labeled inbox by default.
     */
    inbox: "Inbox.md" as string,
    /**
     * Specify which files do you like to be displayed in the file select by default.
     * If left blank, all files where there are task items will be displayed. 
     */
    taskFiles: [] as string[],
    /**
     * Specify a color palette for tags.
     * Note that this will override other color setting for tags.
     */
    tagColorPalette: { "#TODO": "#339988", "#TEST": "#998877" } as any,
    /**
     * Use counters on the today panel or not
     */
    useCounters: true as boolean,
    /**
     * Default behavior for filter buttons,
     * Focus to make items more clear or
     * Filter others out.
     */
    counterBehavior: "Filter" as "Filter" | "Focus",
    /**
     * Use quick entry panel on the today panel or not
     */

    useQuickEntry: true as boolean,
    /**
     * Where to put the entry panel,
     * Top means on top of the view,
     * Bottom means on bottom of the view,
     * Today means in today's view.
     */
    entryPosition: "today" as "today" | "top" | "bottom",
    /**
     * Display which year it is or not.
     */
    useYearHeader: false as boolean,

    /**
     * USE INFO BEGIN
     */
    /**
    * Use relative dates to describe the task dates or not.
    */
    useRelative: true as boolean,
    /**
     * Display recurrence information of tasks or not.
     */
    useRecurrence: true as boolean,
    /**
     * Display priority information of tasks or not.
     */
    usePriority: true as boolean,
    /**
     * Display tags of tasks or not.
     */
    useTags: true as boolean,
    /**
     * Display which file the task is from or not.
     */
    useFileBadge: true as boolean,
    /** 
     * Display which section the task is from or not.
     */
    useSection: true as boolean,
    /**
     * Group tasks inside each date section by their containing folder.
     */
    groupByFolder: false as boolean,
    /**
     * USE INFO END
     */
    /**
     * hide specific status of tasks.
     */
    hideStatusTasks: ['x', '-'] as string[],
    /**
     * Activate today focus on load or not.
     */
    defaultTodayFocus: false as boolean,
    /**
     * Activate a filter or not.
     */
    defaultFilters: "" as string,
    /**
     * Use builtin style (status icons) or not.
     * If disabled, icons defined by the theme will be used.
     */
    useBuiltinStyle: true as boolean,
    /**
     * Convert a 24 hour time prefix in task description (15:30) to 12 hour time with am/pm (3:30 pm)
     */
	convert24HourTimePrefix: false as boolean,
};
export type UserOption = typeof defaultUserOptions;

export class TasksCalendarSettingTab extends PluginSettingTab {
    plugin: TasksCalendarWrapper;
    constructor(app: App, plugin: TasksCalendarWrapper) {
        super(app, plugin);
        this.plugin = plugin;
        this.onOptionUpdate = this.onOptionUpdate.bind(this);
        this.tagsSettingItem = this.tagsSettingItem.bind(this);
    }

    private static createFragmentWithHTML = (html: string) =>
        createFragment((documentFragment) => (documentFragment.createDiv().innerHTML = html));

    private getScrollContainer() {
        let element: HTMLElement | null = this.containerEl;
        while (element && element.parentElement) {
            if (element.scrollHeight > element.clientHeight) return element;
            element = element.parentElement;
        }
        return this.containerEl;
    }

    private restoreSettingsScroll(scrollTop: number) {
        window.requestAnimationFrame(() => {
            this.getScrollContainer().scrollTop = scrollTop;
        });
    }

    private markChildSetting(setting: Setting) {
        setting.settingEl.addClass("tasks-calendar-wrapper-child-setting");
        return setting;
    }

    async onOptionUpdate(updatePart: Partial<UserOption>, refreshSettingPage = false) {
        const scrollTop = this.getScrollContainer().scrollTop;
        await this.plugin.writeOptions(updatePart);
        if (refreshSettingPage) {
            this.display();
            this.restoreSettingsScroll(scrollTop);
        }
    }

    async display() {
        const { containerEl } = this;

        containerEl.empty();

        containerEl.createEl("h1", { text: 'Timeline Settings' });
        containerEl.createEl("h2", { text: "Startup" });

        new Setting(containerEl)
			.setName("Open Timeline On Startup")
			.setDesc("Show the task timeline automatically when Obsidian starts.")
			.addToggle(async (tg) => {
				tg.setValue(this.plugin.userOptions.openViewOnStartup);
				tg.onChange(
					async (v) =>
						await this.onOptionUpdate({ openViewOnStartup: v })
				);
			});

        new Setting(containerEl)
            .setName("Focus Today When Timeline Opens")
            .setDesc("Start with only today's section showing.")
            .addToggle(async tg => {
                tg.setValue(this.plugin.userOptions.defaultTodayFocus);
                tg.onChange(async v => await this.onOptionUpdate({ defaultTodayFocus: v }));
            })

        new Setting(containerEl)
            .setName("Start With A Task Filter")
            .setDesc("Choose which task count is already active when the timeline opens.")
            .addDropdown(async dd => {
                dd.addOptions({
                    "": "No filter",
                    "todoFilter": "Todo",
                    "overdueFilter": "Overdue",
                    "unplannedFilter": "Unplanned",
                });
                dd.setValue(this.plugin.userOptions.defaultFilters);
                dd.onChange(async v => await this.onOptionUpdate({ defaultFilters: v }));
            })

        containerEl.createEl("h2", { text: "Quick Entry" });

        new Setting(containerEl)
            .setName("Add Tasks From Timeline")
            .setDesc("Show a quick-entry box in the timeline.")
            .addToggle(async tg => {
                tg.setValue(this.plugin.userOptions.useQuickEntry);
                tg.onChange(async v => await this.onOptionUpdate({ useQuickEntry: v }, true));
            })

        new Setting(containerEl)
            .setName("Place New Task Box")
            .setDesc("Choose where quick entry appears.")
            .addDropdown(async d => {
                d.addOptions({
                    "today": "Today section",
                    "top": "Top of timeline",
                    "bottom": "Bottom of timeline"
                });
                d.setValue(this.plugin.userOptions.entryPosition);
                d.onChange(async v => await this.onOptionUpdate({ entryPosition: v as "today" | "top" | "bottom" }));
            })

        if (this.plugin.userOptions.useQuickEntry) {
            this.markChildSetting(new Setting(containerEl))
                .setName("Save New Tasks To")
                .setDesc("Missing folders and files are created automatically.")
                .addText(t => {
                    t.setValue(this.plugin.userOptions.inbox);
                    t.onChange(async v => await this.onOptionUpdate({ inbox: v.trim() }));
                })

            this.markChildSetting(new Setting(containerEl))
                .setName("Put New Tasks Under Heading")
                .setDesc("If the heading is missing, the plugin creates it.")
                .addText(t => {
                    t.setValue(this.plugin.userOptions.sectionForNewTasks);
                    t.onChange(async v => await this.onOptionUpdate({ sectionForNewTasks: v }));
                })
        }

        containerEl.createEl("h2", { text: "Timeline Layout" });

        new Setting(containerEl)
            .setName("Show Year Breaks")
            .setDesc("Separate timeline sections by year.")
            .addToggle(tg => {
                tg.setValue(this.plugin.userOptions.useYearHeader);
                tg.onChange(async v => await this.onOptionUpdate({ useYearHeader: v }));
            })

        new Setting(containerEl)
            .setName("Show Task Counts")
            .setDesc("Show Todo, Overdue, and Unplanned counts above the timeline.")
            .addToggle(async tg => {
                tg.setValue(this.plugin.userOptions.useCounters);
                tg.onChange(async v => await this.onOptionUpdate({ useCounters: v }));
            })

        new Setting(containerEl)
            .setName("Clicking Task Counts")
            .setDesc("Choose what happens when a task count is clicked.")
            .addDropdown(async d => {
                d.addOptions(
                    {
                        "Filter": "Show matching tasks only",
                        "Focus": "Highlight matching tasks"
                    }
                );
                d.setValue(this.plugin.userOptions.counterBehavior);
                d.onChange(async v => await this.onOptionUpdate({ counterBehavior: v as typeof this.plugin.userOptions.counterBehavior }));
            })

        new Setting(containerEl)
            .setName("Move Past Tasks To Today")
            .setDesc("Also show overdue, past scheduled, past start, and unplanned tasks in today's section.")
            .addToggle(async tg => {
                tg.setValue(this.plugin.userOptions.forward);
                tg.onChange(async v => await this.onOptionUpdate({ forward: v }));
            })

        new Setting(containerEl)
            .setName("Group Tasks By Folder")
            .setDesc("Show folder headings inside each date section.")
            .addToggle(async tg => {
                tg.setValue(this.plugin.userOptions.groupByFolder);
                tg.onChange(async v => await this.onOptionUpdate({ groupByFolder: v }));
            })


        containerEl.createEl("h2", { text: "Task Cards" });

        new Setting(containerEl)
            .setName("Show Dates As Words")
            .setDesc("Show labels like Today, Tomorrow, or in 3 days.")
            .addToggle(async tg => {
                tg.setValue(this.plugin.userOptions.useRelative);
                tg.onChange(async v => await this.onOptionUpdate({ useRelative: v }));
            })
        new Setting(containerEl)
            .setName("Show Repeating Task Details")
            .setDesc("Show recurrence information on task cards.")
            .addToggle(async tg => {
                tg.setValue(this.plugin.userOptions.useRecurrence);
                tg.onChange(async v => await this.onOptionUpdate({ useRecurrence: v }));
            })
        new Setting(containerEl)
            .setName("Show Priority Labels")
            .setDesc("Show priority badges on task cards.")
            .addToggle(async tg => {
                tg.setValue(this.plugin.userOptions.usePriority);
                tg.onChange(async v => await this.onOptionUpdate({ usePriority: v }));
            })

        new Setting(containerEl)
            .setName("Show Task Status As")
            .setDesc("Choose how task status controls appear in the timeline.")
            .addDropdown(async d => {
                d.addOptions({
                    "checkbox": "Checkboxes",
                    "icons": "Status icons"
                });
                d.setValue(this.plugin.userOptions.useBuiltinStyle ? "icons" : "checkbox");
                d.onChange(async v => await this.onOptionUpdate({ useBuiltinStyle: v === "icons" }));
            })

        new Setting(containerEl)
            .setName("Displayed Date Format")
            .setDesc(TasksCalendarSettingTab.createFragmentWithHTML(
                "Format for visible date labels. Uses Moment.js syntax.\
                See <a href=https://momentjs.com/docs/#/displaying/format/>Moment format docs</a>."
            ))
            .addMomentFormat(async m => {
                m.setPlaceholder("e.g.: YYYY-MM-DD");
                m.setValue(this.plugin.userOptions.dateFormat);
                m.onChange(async v => await this.onOptionUpdate({ dateFormat: v }));
            })

        const tagSettings = new Setting(containerEl);
        tagSettings.controlEl.empty();
        tagSettings.controlEl.appendChild(createEl('div'));
        let tagBadgeSetting = new Setting(tagSettings.controlEl.firstChild as HTMLElement);
        if (this.plugin.userOptions.useTags) {
            Object.entries(this.plugin.userOptions.tagColorPalette).forEach(([tag, color], index) => {
                if (index !== 0 && !(index & 0x01))
                    tagBadgeSetting = new Setting(tagSettings.controlEl.firstChild as HTMLElement);
                tagBadgeSetting.controlEl.appendChild(createEl('div', { cls: "tag", text: `${tag}`, attr: { style: `color: ${color}` } }));
                tagBadgeSetting
                    .addExtraButton(async btn => {
                        btn.setIcon("pencil")
                            .setTooltip("Edit")
                            .onClick(async () => {
                                const modal = new TagColorPaletteModal(this.plugin, tag, color as string);
                                modal.onClose = async () => {
                                    if (!modal.valid) return;
                                    delete this.plugin.userOptions.tagColorPalette[tag];
                                    this.plugin.userOptions.tagColorPalette[normalizeTagText(modal.tagText)] = modal.color;

                                    await this.onOptionUpdate({}, true);
                                }
                                modal.open();
                            })

                    })
                    .addExtraButton(async btn => {
                        btn.setIcon("cross")
                            .setTooltip("Delete")
                            .onClick(async () => {
                                delete this.plugin.userOptions.tagColorPalette[tag]

                                await this.onOptionUpdate({}, true);
                            })
                    })
            })

            tagSettings
                .addExtraButton(async btn => {
                    btn.setIcon("plus-with-circle")
                        .setTooltip("Add a palette")
                        .onClick(async () => {
                            const modal = new TagColorPaletteModal(this.plugin)
                            modal.onClose = async () => {
                                if (!modal.valid) return;
                                this.plugin.userOptions.tagColorPalette[normalizeTagText(modal.tagText)] = modal.color;

                                await this.onOptionUpdate({}, true);
                            }
                            modal.open();
                        })
                })
        }

        tagSettings
            .setName("Show Tags On Tasks")
            .setDesc("Tag colors can be customized here.")
            .addToggle(tg => {
                tg.setValue(this.plugin.userOptions.useTags);
                tg.onChange(async v => {
                    await this.onOptionUpdate({ useTags: v }, true)
                });
            })


        this.tagsSettingItem(containerEl, "Hide Tags",
            "Tags to hide from task cards. Tags remain in your notes and still count for filtering.",
            this.plugin.userOptions.hideTags,
            (t: string) => {
                return async () => {
                    this.plugin.userOptions.hideTags.remove(t);
                    await this.onOptionUpdate({}, true);
                }
            },
            async (t: string) => {
                if (this.plugin.userOptions.hideTags.includes(t)) {
                    new Notice(`Tag ${t} already exists.`, 5000);
                } else {
                    this.plugin.userOptions.hideTags.push(t);
                    await this.onOptionUpdate({}, true);
                }
            })

        new Setting(containerEl)
            .setName("Show Where Tasks Come From")
            .setDesc("Show the source note on task cards.")
            .addToggle(async tg => {
                tg.setValue(this.plugin.userOptions.useFileBadge);
                tg.onChange(async v => this.onOptionUpdate({ useFileBadge: v }));
            })
        new Setting(containerEl)
            .setName("Show Source Headings")
            .setDesc("Show the heading or section each task comes from.")
            .addToggle(async tg => {
                tg.setValue(this.plugin.userOptions.useSection);
                tg.onChange(async v => await this.onOptionUpdate({ useSection: v }));
            })

        containerEl.createEl("h2", { text: "Sorting" })
        new Setting(containerEl)
            .setName("Sort Tasks By")
            .setDesc(TasksCalendarSettingTab.createFragmentWithHTML(
                "Choose how tasks are sorted inside each date section."))
            .addDropdown(async ta => {
                ta.addOptions(sortOptions);
                ta.setValue(this.plugin.userOptions.sort);
                ta.onChange(async v => {
                    await this.onOptionUpdate({ sort: v });
                })
            })

        new Setting(containerEl)
            .setName("Show 24-Hour Times As 12-Hour Times")
            .setDesc("Example: 15:30 becomes 3:30 pm.")
            .addToggle(async tg => {
                tg.setValue(this.plugin.userOptions.convert24HourTimePrefix);
                tg.onChange(async v => await this.onOptionUpdate({ convert24HourTimePrefix: v }));
            })

        containerEl.createEl("h2", { text: "Filters" })

        new Setting(containerEl)
            .setName("Hide Tasks With These Statuses")
            .setDesc("Status markers to hide. Use x for completed, - for cancelled, or [ ] for unchecked tasks.")
            .addText(async t => {
                t.setPlaceholder("x, -, [ ]");
                t.setValue(this.plugin.userOptions.hideStatusTasks.join(','));
                t.onChange(async v => await this.onOptionUpdate({
                    hideStatusTasks: splitCommaList(v).map(s => s === "[ ]" ? " " : s)
                }))
            });

        new Setting(containerEl)
            .setName("Limit Timeline To Matching Tags")
            .setDesc("Turn this on to show only tasks or notes with the tags listed below.")
            .addToggle(tg => {
                tg
                    .setValue(this.plugin.userOptions.useIncludeTags)
                    .onChange(async v => await this.onOptionUpdate({ useIncludeTags: v }, true));
            });

        if (this.plugin.userOptions.useIncludeTags) {
            this.tagsSettingItem(containerEl, "Task Tags To Include",
                "Only show tasks with one or more of these tags.",
                this.plugin.userOptions.taskIncludeTags,
                (t: string) => {
                    return async () => {
                        this.plugin.userOptions.taskIncludeTags.remove(t);
                        await this.onOptionUpdate({}, true);
                    }
                },
                async (t: string) => {
                    if (this.plugin.userOptions.taskIncludeTags.contains(t)) {
                        new Notice(`Tag ${t} already exists.`, 5000);
                    } else {
                        this.plugin.userOptions.taskIncludeTags.push(t);
                        await this.onOptionUpdate({}, true);
                    }
                },
                true);

            this.tagsSettingItem(containerEl, "Note Tags To Include",
                "Only show tasks from notes containing one or more of these tags.",
                this.plugin.userOptions.fileIncludeTags,
                (t: string) => {
                    return async () => {
                        this.plugin.userOptions.fileIncludeTags.remove(t);
                        await this.onOptionUpdate({}, true);
                    }
                },
                async (t: string) => {
                    if (this.plugin.userOptions.fileIncludeTags.contains(t)) {
                        new Notice(`Tag ${t} already exists.`, 5000);
                    } else {
                        this.plugin.userOptions.fileIncludeTags.push(t);
                        await this.onOptionUpdate({}, true);
                    }
                },
                true)
        }


        new Setting(containerEl)
            .setName("Hide Timeline Items With Matching Tags")
            .setDesc("Turn this on to hide tasks or notes with the tags listed below.")
            .addToggle(tg => {
                tg
                    .setValue(this.plugin.userOptions.useExcludeTags)
                    .onChange(async v => await this.onOptionUpdate({ useExcludeTags: v }, true));
            });

        if (this.plugin.userOptions.useExcludeTags) {
            this.tagsSettingItem(containerEl, "Task Tags To Hide",
                "Hide tasks containing any of these tags.",
                this.plugin.userOptions.taskExcludeTags,
                (t: string) => {
                    return async () => {
                        this.plugin.userOptions.taskExcludeTags.remove(t);
                        await this.onOptionUpdate({}, true);
                    }
                },
                async (t: string) => {
                    if (this.plugin.userOptions.taskExcludeTags.contains(t)) {
                        new Notice(`Tag ${t} already exists.`, 5000);
                    } else {
                        this.plugin.userOptions.taskExcludeTags.push(t);
                        await this.onOptionUpdate({}, true);
                    }
                },
                true);

            this.tagsSettingItem(containerEl, "Note Tags To Hide",
                "Hide tasks from notes containing any of these tags.",
                this.plugin.userOptions.fileExcludeTags,
                (t: string) => {
                    return async () => {
                        this.plugin.userOptions.fileExcludeTags.remove(t);
                        await this.onOptionUpdate({}, true);
                    }
                },
                async (t: string) => {
                    if (this.plugin.userOptions.fileExcludeTags.contains(t)) {
                        new Notice(`Tag ${t} already exists.`, 5000);
                    } else {
                        this.plugin.userOptions.fileExcludeTags.push(t);
                        await this.onOptionUpdate({}, true);
                    }
                },
                true)
        }

        new Setting(containerEl)
            .setName("Hide These Folders Or Notes")
            .setDesc("Comma-separated folders or notes to hide. Leading/trailing slashes are okay.")
            .addTextArea(ta => {
                ta.setPlaceholder("Archive, Templates, Projects/Done.md");
                ta.setValue(this.plugin.userOptions.excludePaths.join(","));
                ta.onChange(async v => {
                    await this.onOptionUpdate({ excludePaths: splitCommaList(v) });
                })
            })

        new Setting(containerEl)
            .setName("Only Show These Folders Or Notes")
            .setDesc("Comma-separated folders or notes to show. Leave blank to include the whole vault.")
            .addTextArea(ta => {
                ta.setPlaceholder("Projects, Inbox.md");
                ta.setValue(this.plugin.userOptions.includePaths.join(","));
                ta.onChange(async v => {
                    await this.onOptionUpdate({ includePaths: splitCommaList(v) });
                })
            })

        new Setting(containerEl)
            .setName("Hide Empty Tasks")
            .setDesc("Hide empty task items.")
            .addToggle(to => {
                to.setValue(this.plugin.userOptions.filterEmpty);
                to.onChange(async v => {
                    await this.onOptionUpdate({ filterEmpty: v });
                })
            })
    }

    private tagsSettingItem = (
        container: HTMLElement,
        name: string,
        desc: string,
        tags: string[],
        ondelete: (t: string) => (() => Promise<void>),
        onadd: (t: string) => Promise<void>,
        childSetting = false,
    ) => {
        const tagsSetting = new Setting(container)
            .setName(name)
            .setDesc(desc)
        if (childSetting) this.markChildSetting(tagsSetting);
        tagsSetting.controlEl.empty();
        tagsSetting.controlEl.appendChild(createDiv());
        let tagsSettingControlEl = new Setting(tagsSetting.controlEl.firstChild as HTMLElement);
        tags.forEach((t, i) => {
            if (i !== 0 && i % 3 === 0) tagsSettingControlEl = new Setting(tagsSetting.controlEl.firstChild as HTMLElement);
            tagsSettingControlEl.controlEl.appendChild(createEl('div', { cls: "tag", text: t }));
            tagsSettingControlEl.addExtraButton(eb => {
                eb
                    .setIcon("cross")
                    .setTooltip("Delete")
                    .onClick(ondelete(t));
            })
        })

        tagsSetting.addExtraButton(eb => {
            eb.setIcon("plus-with-circle");
            eb.onClick(() => {
                const modal = new TagModal(this.plugin);
                modal.onClose = async () => {
                    if (!modal.valid) return;
                    await onadd(modal.tagText);
                };
                modal.open();
            })
        })
    }
}


class TagColorPaletteModal extends Modal {
    tagText: string;
    color: string;
    valid: boolean;
    constructor(plugin: Plugin, tag?: string, color?: string) {
        super(plugin.app);
        this.tagText = tag || "";
        this.color = color || "";
        this.valid = false;
    }
    onOpen(): void {
        this.display();
    }
    display() {
        const { contentEl } = this;
        contentEl.empty();
        const settingdiv = contentEl.createDiv();
        new Setting(settingdiv)
            .setName("Tag and color")
            .setDesc("Choose the tag and the color to use for it.")
            .addText(t => {
                t.setValue(this.tagText);
                t.onChange(v => this.tagText = v);
            })
            .addColorPicker(cp => {
                cp.setValue(this.color);
                cp.onChange(v => this.color = v);
            })
        const footer = contentEl.createDiv();
        new Setting(footer)
            .addButton(btn => {
                btn.setIcon("checkmark");
                btn.setTooltip("Save");
                btn.onClick(() => {
                    this.tagText = normalizeTagText(this.tagText);
                    if (!this.tagText.match(TaskRegularExpressions.hashTags)) {
                        this.valid = false;
                        return new Notice(`${this.tagText} seems not a valid tag.`, 5000)
                    }
                    if (this.color === "") {
                        this.valid = false;
                        return new Notice("The color seems to be empty, maybe you forget to click the color picker.", 5000);
                    }
                    this.valid = true;
                    this.close();
                });
                return btn;
            })
            .addButton(btn => {
                btn.setIcon("cross");
                btn.setTooltip("Cancel");
                btn.onClick(() => {
                    this.valid = false;
                    this.close();
                });
                return btn;
            })
    }
}

class TagModal extends Modal {
    tagText: string;
    valid: boolean;
    constructor(plugin: Plugin) {
        super(plugin.app);
        this.tagText = "";
        this.valid = false;
    }
    onOpen(): void {
        this.display();
    }
    display() {
        const { contentEl } = this;
        contentEl.empty();
        const settingdiv = contentEl.createDiv();
        new Setting(settingdiv)
            .setName("Tag")
            .setDesc("Enter the tag to add. Include # at the beginning.")
            .addText(t => {
                t.setValue(this.tagText);
                t.onChange(v => {
                    this.tagText = v
                });
                return t;
            })
        const footer = contentEl.createDiv();
        new Setting(footer)
            .addButton(btn => {
                btn.setIcon("checkmark");
                btn.setTooltip("Save");
                btn.onClick(() => {
                    if (!this.tagText.match(TaskRegularExpressions.hashTags)) {
                        this.valid = false;
                        new Notice(`${this.tagText} seems not a valid tag.`, 5000)
                    } else {
                        this.valid = true;
                    }
                    this.close();
                });
                return btn;
            })
            .addButton(btn => {
                btn.setIcon("cross");
                btn.setTooltip("Cancel");
                btn.onClick(() => {
                    this.valid = false;
                    this.close();
                });
                return btn;
            })
    }
}
