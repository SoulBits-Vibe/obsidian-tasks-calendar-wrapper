import { describe, expect, it } from "vitest";
import { counterModeClass } from "../utils/timelineclasses";

describe("timeline counter mode classes", () => {
	it("clears the counter class when no task count is active", () => {
		expect(counterModeClass("", "Filter")).toBe("");
		expect(counterModeClass("", "Focus")).toBe("");
	});

	it("builds filter classes for show-only mode", () => {
		expect(counterModeClass("todoFilter", "Filter")).toBe("todoFilter");
		expect(counterModeClass("overdueFilter", "Filter")).toBe("overdueFilter");
		expect(counterModeClass("unplannedFilter", "Filter")).toBe("unplannedFilter");
	});

	it("builds focus classes for highlight mode", () => {
		expect(counterModeClass("todoFilter", "Focus")).toBe("todoFocus");
		expect(counterModeClass("overdueFilter", "Focus")).toBe("overdueFocus");
		expect(counterModeClass("unplannedFilter", "Focus")).toBe("unplannedFocus");
	});
});
