export type CounterBehavior = "Filter" | "Focus";

export function counterModeClass(filter: string, counterBehavior: CounterBehavior) {
    return filter.length === 0 ? "" : `${filter.replace(/Filter$/, "")}${counterBehavior}`;
}
