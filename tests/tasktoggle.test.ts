import { describe, expect, it } from "vitest";
import { toggleTaskInContent, toggleTaskLineDone } from "../utils/tasktoggle";

describe("task source toggle helpers", () => {
	it("completes an in-progress marker without losing task text", () => {
		expect(toggleTaskLineDone("- [/] Started task #tag", "2026-06-14"))
			.toBe("- [x] Started task #tag ✅ 2026-06-14");
	});

	it("completes custom markers through the same fast path", () => {
		expect(toggleTaskLineDone("- [>] Planned task", "2026-06-14"))
			.toBe("- [x] Planned task ✅ 2026-06-14");
		expect(toggleTaskLineDone("- [<] Delegated task", "2026-06-14"))
			.toBe("- [x] Delegated task ✅ 2026-06-14");
	});

	it("does not add a duplicate done date", () => {
		expect(toggleTaskLineDone("- [/] Started task ✅ 2026-06-10", "2026-06-14"))
			.toBe("- [x] Started task ✅ 2026-06-10");
	});

	it("can uncomplete a visible completed task", () => {
		expect(toggleTaskLineDone("- [x] Done task ✅ 2026-06-14", "2026-06-14"))
			.toBe("- [ ] Done task");
	});

	it("updates only the selected source line", () => {
		const content = ["# Tasks", "- [ ] First", "- [/] Second"].join("\n");

		expect(toggleTaskInContent(content, 2, "2026-06-14"))
			.toBe(["# Tasks", "- [ ] First", "- [x] Second ✅ 2026-06-14"].join("\n"));
	});
});
