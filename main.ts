import { Plugin, Editor, PluginSettingTab, App, Setting } from "obsidian";

interface ListMarkerSettings {
	marker: string;
}

const DEFAULT_SETTINGS: ListMarkerSettings = {
	marker: "[<<<]",
};

export default class ListMarkerPlugin extends Plugin {
	settings: ListMarkerSettings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new ListMarkerSettingTab(this.app, this));

		this.addCommand({
			id: "move-marker-up",
			name: "Move marker up",
			hotkeys: [{ modifiers: ["Alt"], key: "ArrowUp" }],
			editorCallback: (editor: Editor) => this.moveMarker(editor, -1),
		});

		this.addCommand({
			id: "move-marker-down",
			name: "Move marker down",
			hotkeys: [{ modifiers: ["Alt"], key: "ArrowDown" }],
			editorCallback: (editor: Editor) => this.moveMarker(editor, 1),
		});

		this.addCommand({
			id: "toggle-marker",
			name: "Toggle marker on current line",
			hotkeys: [{ modifiers: ["Alt"], key: "[" }],
			editorCallback: (editor: Editor) => this.toggleMarker(editor),
		});

		this.registerEvent(
			this.app.workspace.on("file-open", () => {
				const editor = this.app.workspace.activeEditor?.editor;
				if (editor) this.initializeMarker(editor);
			})
		);
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	initializeMarker(editor: Editor) {
		// Check if there is already a marker in the file
		const totalLines = editor.lineCount();
		let markerExists = false;
		for (let i = 0; i < totalLines; i++) {
			const line = editor.getLine(i);
			if (line.includes(this.settings.marker)) {
				markerExists = true;
				break;
			}
		}

		// If a marker exists, ensure only one marker is present
		if (markerExists) {
			let markerAdded = false;
			for (let i = 0; i < totalLines; i++) {
				const line = editor.getLine(i);
				if (line.includes(this.settings.marker)) {
					if (!markerAdded && this.isListItem(line)) {
						markerAdded = true;
						const newText = editor.getLine(i);
						const positionBeforeMarker =
							newText.length - this.settings.marker.length - 1;
						editor.setCursor({ line: i, ch: positionBeforeMarker });
					} else {
						editor.setLine(
							i,
							line.replace(` ${this.settings.marker}`, "")
						);
					}
				}
			}
		}
	}

	isListItem(line: string): boolean {
		return /^\s*[-*+] /.test(line) || /^\s*\d+\. /.test(line);
	}

	getIndentLevel(line: string): number {
		const match = line.match(/^\s*/);
		return match ? match[0].length : 0;
	}

	toggleMarker(editor: Editor) {
		const cursor = editor.getCursor();
		const currentLine = cursor.line;
		let currentText = editor.getLine(currentLine);

		// Remove marker from all other lines
		const totalLines = editor.lineCount();
		for (let i = 0; i < totalLines; i++) {
			const line = editor.getLine(i);
			if (line.includes(this.settings.marker)) {
				editor.setLine(i, line.replace(` ${this.settings.marker}`, ""));
			}
		}

		// Toggle marker on the current line
		if (currentText.endsWith(` ${this.settings.marker}`)) {
			currentText = currentText.replace(` ${this.settings.marker}`, "");
			editor.setLine(currentLine, currentText);
		} else {
			currentText = currentText + ` ${this.settings.marker}`;
			editor.setLine(currentLine, currentText);
		}

		// Set cursor position before the marker (or where it was)
		const newText = editor.getLine(currentLine);
		const positionBeforeMarker =
			newText.length -
			(newText.endsWith(this.settings.marker)
				? this.settings.marker.length + 1
				: 0);
		editor.setCursor({ line: currentLine, ch: positionBeforeMarker });
	}

	moveMarker(editor: Editor, direction: number) {
		const cursor = editor.getCursor();
		let currentLine = cursor.line;
		let currentText = editor.getLine(currentLine);

		// Do nothing if there is no marker on the current line
		if (!currentText.includes(this.settings.marker)) {
			return;
		}

		editor.setLine(
			currentLine,
			currentText.replace(` ${this.settings.marker}`, "")
		);

		let newLine = currentLine;
		let found = false;
		const totalLines = editor.lineCount();
		const currentIndent = this.getIndentLevel(currentText);

		while (!found) {
			newLine += direction;
			if (newLine < 0 || newLine >= totalLines) break;

			const lineText = editor.getLine(newLine);
			if (this.isListItem(lineText)) {
				const newIndent = this.getIndentLevel(lineText);
				if (direction > 0) {
					if (
						newIndent <= currentIndent ||
						(newIndent > currentIndent &&
							newLine === currentLine + 1)
					) {
						found = true;
					}
				} else {
					if (
						newIndent <= currentIndent ||
						(newIndent > currentIndent &&
							newLine === currentLine - 1)
					) {
						found = true;
					}
				}
			}
		}

		if (found) {
			const newText = editor.getLine(newLine);
			editor.setLine(newLine, newText + ` ${this.settings.marker}`);
			const positionBeforeMarker = newText.length;
			editor.setCursor({ line: newLine, ch: positionBeforeMarker });
		} else {
			// If no suitable line is found, restore the marker on the current line
			editor.setLine(currentLine, currentText);
			const positionBeforeMarker =
				currentText.length - this.settings.marker.length - 1;
			editor.setCursor({ line: currentLine, ch: positionBeforeMarker });
		}
	}

	onunload() {
		const editor = this.app.workspace.activeEditor?.editor;
		if (editor) {
			const totalLines = editor.lineCount();
			for (let i = 0; i < totalLines; i++) {
				const line = editor.getLine(i);
				if (line.includes(this.settings.marker)) {
					editor.setLine(
						i,
						line.replace(` ${this.settings.marker}`, "")
					);
				}
			}
		}
	}
}

class ListMarkerSettingTab extends PluginSettingTab {
	plugin: ListMarkerPlugin;

	constructor(app: App, plugin: ListMarkerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Marker text")
			.setDesc("The text to use as the marker for list items.")
			.addText((text) =>
				text
					.setPlaceholder("[<<<]")
					.setValue(this.plugin.settings.marker)
					.onChange(async (value) => {
						this.plugin.settings.marker =
							value || DEFAULT_SETTINGS.marker;
						await this.plugin.saveSettings();
					})
			);
	}
}
