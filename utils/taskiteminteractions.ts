export const taskRowInteractiveSelector = ".internal-link, .external-link, a[href], .tag, [aria-label='Modify Task']";

export function shouldOpenTaskRowFromTarget(target: Element | null) {
	return !target?.closest(taskRowInteractiveSelector);
}

export function internalLinkTextFromTarget(target: Element | null) {
	const link = target?.closest(".internal-link");
	if (!link) return undefined;
	const linkText = link.getAttribute("data-href") ||
		link.getAttribute("href") ||
		link.textContent;
	return linkText?.trim() || undefined;
}
