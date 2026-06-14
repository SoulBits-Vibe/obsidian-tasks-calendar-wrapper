import { Model } from "backbone";
import { describe, expect, it, vi } from "vitest";
import { defaultUserOptions } from "../src/settings";
import { ObsidianBridge } from "../Obsidian-Tasks-Timeline/src/obsidianbridge";

function createBridge(options: Partial<typeof defaultUserOptions> = {}, initialFiles: Record<string, string> = {}) {
	const files = new Map(Object.entries(initialFiles));
	const folders = new Set<string>();
	const createdFolders: string[] = [];
	const saveData = vi.fn();

	const app = {
		vault: {
			adapter: {
				exists: vi.fn(async (path: string) => files.has(path) || folders.has(path)),
				read: vi.fn(async (path: string) => files.get(path) ?? ""),
				write: vi.fn(async (path: string, content: string) => {
					files.set(path, content);
				}),
			},
			createFolder: vi.fn(async (path: string) => {
				createdFolders.push(path);
				folders.add(path);
			}),
			create: vi.fn(async (path: string, content: string) => {
				files.set(path, content);
			}),
		},
		plugins: {
			plugins: {
				"tasks-calendar-wrapper": {
					userOptions: { ...defaultUserOptions, ...options },
					saveData,
				},
			},
		},
	};
	const userOptionModel = new Model({ ...defaultUserOptions, ...options });

	const bridge = new ObsidianBridge({
		plugin: { app },
		userOptionModel,
		taskListModel: new Model({ taskList: [] }),
	} as any);
	bridge.onUpdateTasks = vi.fn();

	return { app, bridge, createdFolders, files, saveData, userOptionModel };
}

describe("ObsidianBridge quick entry writes", () => {
	it("adds a new task below the configured heading in an existing note", async () => {
		const { bridge, files } = createBridge(
			{ sectionForNewTasks: "## Tasks" },
			{ "Inbox.md": "# Inbox\n\n## Tasks\n- [ ] Existing" },
		);

		await bridge.handleCreateNewTask("Inbox.md", "New item");

		expect(files.get("Inbox.md")).toBe("# Inbox\n\n## Tasks\n- [ ] New item\n- [ ] Existing");
	});

	it("adds the configured heading when an existing note does not have it", async () => {
		const { bridge, files } = createBridge(
			{ sectionForNewTasks: "## Capture" },
			{ "Inbox.md": "# Inbox\nIntro" },
		);

		await bridge.handleCreateNewTask("Inbox.md", "New item");

		expect(files.get("Inbox.md")).toBe("# Inbox\nIntro\n\n## Capture\n- [ ] New item");
	});

	it("creates a missing note with the configured heading", async () => {
		const { bridge, files } = createBridge({ sectionForNewTasks: "## Tasks" });

		await bridge.handleCreateNewTask("Inbox.md", "New item");

		expect(files.get("Inbox.md")).toBe("## Tasks\n- [ ] New item");
	});

	it("creates missing parent folders for a configured folder target", async () => {
		const { bridge, createdFolders, files } = createBridge({ sectionForNewTasks: "## Tasks" });

		await bridge.handleCreateNewTask("Areas/Home/Inbox.md", "New item");

		expect(createdFolders).toEqual(["Areas", "Areas/Home"]);
		expect(files.get("Areas/Home/Inbox.md")).toBe("## Tasks\n- [ ] New item");
	});
});

describe("ObsidianBridge display setting persistence", () => {
	it("updates and saves the status style toggle without a task reload", async () => {
		const { bridge, saveData, userOptionModel } = createBridge({ useBuiltinStyle: false });

		await bridge.handleToggleStatusStyle();

		expect(userOptionModel.get("useBuiltinStyle")).toBe(true);
		expect(saveData).toHaveBeenCalledWith(expect.objectContaining({ useBuiltinStyle: true }));
	});

	it("updates and saves the folder grouping toggle without a task reload", async () => {
		const { bridge, saveData, userOptionModel } = createBridge({ groupByFolder: false });

		await bridge.handleToggleGroupByFolder();

		expect(userOptionModel.get("groupByFolder")).toBe(true);
		expect(saveData).toHaveBeenCalledWith(expect.objectContaining({ groupByFolder: true }));
	});
});
