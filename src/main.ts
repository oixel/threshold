import { App, Editor, MarkdownView, Modal, Notice, Plugin, Menu, TFile } from 'obsidian';
import { DEFAULT_SETTINGS, ThresholdSettings, SampleSettingTab } from "./settings";

// 
function isImage(filename: string): boolean {
	const supportedExtensions: Set<string> = new Set([
		"jpg",
		"jpeg",
		"png",
		"webp",
		"heic",
		"heif",
		"avif",
		"tif",
		"tiff",
		"bmp",
		"svg",
		"gif",
	]);

	if (filename) {
		const extension = filename.split(".").pop()?.toLowerCase();
		if (extension && supportedExtensions.has(extension)) return true;
	}

	return false;
}

// Remember to rename these classes and interfaces!
export default class Threshold extends Plugin {
	async onload() {
		// Detect right click on image in file explorer
		this.registerEvent(this.app.workspace.on('file-menu', (menu: Menu, file: TFile) => {
			if (file instanceof TFile && isImage(file.name)) {
				menu.addItem((item) => {
					item
						.setTitle("Apply threshold")
						.setIcon("image")
						.onClick(() => {
							new ThresholdModal(this.app, this, file).open();
						});
				})
			}

		}));
	}
}

export class ThresholdModal extends Modal {
	constructor(app: App, private plugin: Threshold, file: TFile) {
		super(app);
		this.titleEl.setText(`Apply Threshold: ${file.name}`);
		this.setContent('Look at me, I\'m a modal! 👀')
	}
}