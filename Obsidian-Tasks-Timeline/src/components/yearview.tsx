import moment from 'moment';
import * as React from 'react';
import * as TaskMapable from '../../../utils/taskmapable';
import { innerDateFormat } from '../../../utils/tasks';
import { TaskListContext } from './context';
import { CollapseRegistry, DateView } from './dateview';

const defaultYearViewProps = {
    year: 2023 as number,
    bulkCollapsed: false as boolean,
    bulkCollapseVersion: 0 as number,
    collapseRegistry: { dates: new Map(), folders: new Map() } as CollapseRegistry,
};
type YearViewProps = Readonly<typeof defaultYearViewProps>;
export class YearView extends React.Component<YearViewProps> {
    render(): React.ReactNode {
        return (
            <TaskListContext.Consumer>{({ taskList, entryOnDate }) => {
                const tasksOfThisYear = taskList;
                const daysOfThisYear: Set<string> = new Set();
                tasksOfThisYear.forEach((t) => {
                    const primaryDate = TaskMapable.getPrimaryTimelineDate(t);
                    primaryDate && daysOfThisYear.add(primaryDate.format(innerDateFormat));
                })
                if (this.props.year === moment(entryOnDate).year() && !daysOfThisYear.has(entryOnDate))
                    daysOfThisYear.add(entryOnDate);
                return (
                    <div>
                        {tasksOfThisYear.length > 0 &&
                            <YearHeader year={this.props.year} dataTypes={[...new Set(tasksOfThisYear.map(t => t.status))]} />}
                        {[...daysOfThisYear]
                            .filter(d => moment(d).year() === this.props.year)
                            .sort()
                            .map((d) => {
                                const tasksOfThisDate = tasksOfThisYear.filter(TaskMapable.filterDate(moment(d)));
                                return (
                                    <TaskListContext.Provider value={{ taskList: tasksOfThisDate, entryOnDate: entryOnDate }} key={d}>
                                        <DateView date={moment(d)} bulkCollapsed={this.props.bulkCollapsed}
                                            bulkCollapseVersion={this.props.bulkCollapseVersion}
                                            collapseRegistry={this.props.collapseRegistry} />
                                    </TaskListContext.Provider>
                                )
                            })}
                    </div>)
            }}
            </TaskListContext.Consumer>
        );
    }
}

const defaultYearHeaderProps = {
    year: 2023 as number,
    dataTypes: [] as string[],
}
type YearHeaderProps = Readonly<typeof defaultYearHeaderProps>;
class YearHeader extends React.Component<YearHeaderProps> {
    render(): React.ReactNode {
        const yearMoment = moment().year(this.props.year);
        return (
            <div className={"year" + (yearMoment.isSame(moment(), 'year') ? " current" : "")}
                data-types={this.props.dataTypes.join(" ")}>
                {yearMoment.format("YYYY")}
            </div>
        );
    }
}
