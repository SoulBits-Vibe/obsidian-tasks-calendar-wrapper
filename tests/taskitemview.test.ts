import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { internalLinkTextFromTarget, shouldOpenTaskRowFromTarget, taskRowInteractiveSelector } from "../utils/taskiteminteractions";

function targetWithClosest(match: boolean): Element {
	return {
		closest: (selector: string) => {
			expect(selector).toBe(taskRowInteractiveSelector);
			return match ? ({} as Element) : null;
		},
	} as Element;
}

function internalLinkTarget(attributes: Record<string, string | undefined>, textContent = ""): Element {
	const link = {
		getAttribute: (name: string) => attributes[name],
		textContent,
	};
	return {
		closest: (selector: string) => selector === ".internal-link" ? link : null,
	} as unknown as Element;
}

function targetWithoutInternalLink(): Element {
	return {
		closest: () => null,
	} as unknown as Element;
}

describe("task item row interactions", () => {
	it("opens the source task when clicking plain row content", () => {
		expect(shouldOpenTaskRowFromTarget(targetWithClosest(false))).toBe(true);
	});

	it("does not open the source row when clicking links, tags, or the edit control", () => {
		expect(shouldOpenTaskRowFromTarget(targetWithClosest(true))).toBe(false);
	});

	it("keeps rendered markdown content out of an anchor wrapper so wiki links remain clickable", () => {
		const source = readFileSync(resolve(__dirname, "../Obsidian-Tasks-Timeline/src/components/taskitemview.tsx"), "utf8");

		expect(source).toContain('return <span className="taskContentMarkdown"');
		expect(source).not.toContain("return <a dangerouslySetInnerHTML");
	});

	it("extracts wiki link targets from rendered internal links", () => {
		expect(internalLinkTextFromTarget(internalLinkTarget({ "data-href": "Inbox", href: "Wrong" }))).toBe("Inbox");
		expect(internalLinkTextFromTarget(internalLinkTarget({ href: "Inbox" }))).toBe("Inbox");
		expect(internalLinkTextFromTarget(internalLinkTarget({}, "Inbox"))).toBe("Inbox");
		expect(internalLinkTextFromTarget(targetWithoutInternalLink())).toBeUndefined();
	});
});
