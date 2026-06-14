import moment from "moment";

export { moment };

export const MarkdownRenderer = {
	renderMarkdown(markdown: string, el: HTMLElement) {
		el.innerHTML = `<p>${markdown}</p>`;
	},
};

export class Notice {
	message: string;
	timeout?: number;

	constructor(message: string, timeout?: number) {
		this.message = message;
		this.timeout = timeout;
	}
}

export class Plugin {
	app: any;

	constructor(app?: any) {
		this.app = app;
	}
}

export class PluginSettingTab {
	app: any;
	plugin: any;
	containerEl: any;

	constructor(app?: any, plugin?: any) {
		this.app = app;
		this.plugin = plugin;
		this.containerEl = {};
	}
}

export class Modal {
	app: any;
	contentEl: any;

	constructor(app?: any) {
		this.app = app;
		this.contentEl = {};
	}
}

export class Setting {
	constructor(_containerEl?: any) { }
}

export class ItemView {
	app: any;
	leaf: any;
	containerEl: any;

	constructor(leaf?: any) {
		this.leaf = leaf;
		this.app = leaf?.app;
		this.containerEl = {};
	}
}

export function normalizePath(path: string) {
	return path.replace(/\\/g, "/").replace(/\/+/g, "/");
}
