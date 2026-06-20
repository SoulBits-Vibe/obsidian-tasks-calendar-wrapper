import moment from 'moment';
import { Pos } from 'obsidian';
import * as React from 'react';
import { TaskDataModel } from '../../../utils/tasks';
import { CounterProps } from './dateview';

export const TaskListContext = React.createContext({
    taskList: [] as TaskDataModel[],
    entryOnDate: moment().toString() as string,
})

export const UserOptionContext = React.createContext({
    select: "" as string,
    counters: [] as CounterProps[],
    dateFormat: "YYYY-MM-DD" as string,
    tagPalette: {} as any,
    hideTags: [] as string[],
    forward: false as boolean,
    useBuiltinStyle: true as boolean,
    groupByFolder: false as boolean,
    controlsOpen: false as boolean,
    searchQuery: "" as string,
    handleSearchChange: (_event: React.FormEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement>) => { },
    handleBulkCollapse: (_collapsed: boolean) => { },
});

export const QuickEntryHandlerContext = React.createContext({
    handleCreateNewTask: async (filePath: string, content: string) => { },
});

export const TodayFocusEventHandlersContext = React.createContext({
    handleTodayFocusClick: () => { },
})

export const TaskItemEventHandlersContext = React.createContext({
    handleOpenFile: (filePath: string, position: Pos) => { },
    handleCompleteTask: (filePath: string, position: Pos) => { },
    handleTagClick: (tag: string) => { },
    handleModifyTask: undefined as any,
    handleToggleStatusStyle: () => { },
    handleToggleGroupByFolder: () => { },
})
