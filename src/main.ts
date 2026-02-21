// import { App, Editor, MarkdownView, Modal, Notice, Plugin, Menu, TFile, View } from 'obsidian';
// import { DEFAULT_SETTINGS, ThresholdSettings, SampleSettingTab } from "./settings";

// function addContextmenu()

// // Remember to rename these classes and interfaces!
// export default class Threshold extends Plugin {
// 	async onload() {
// 		// Detect right click on image in file explorer
// 		this.registerEvent(this.app.workspace.on('file-menu', (menu: Menu, file: TFile) => {
// 			

// 		}));

// 		this.registerEvent(this.app.workspace.on('editor-menu', (menu: Menu, editor: Editor, view: MarkdownView) => {

// 		}));

// 		// Adds "Apply threshold" context menu option if context menu is triggered on an image
// 		this.registerDomEvent(document, "contextmenu", (event: MouseEvent) => {
// 			const target = event.target as HTMLElement;
// 			const view = this.app.workspace.getActiveViewOfType(View);
// 			const isCanvasView = view?.getViewType() === "canvas";

// 			if (isCanvasView) return;

// 			const image = target instanceof HTMLImageElement ? target : target.closest("img");
// 			if (!image) return;

// 			const menu = new Menu();

// 			let file = this.app.workspace.getActiveFile();

// 			if (file) {
// 				menu.addItem((item) => {
// 					item
// 						.setTitle("Apply test")
// 						.setIcon("image")
// 						.onClick(() => {
// 							new ThresholdModal(this.app, this, file).open();
// 						});
// 				})
// 			}
// 		}, true);
// 	}
// }



import { Plugin, Menu, TFile, Modal, App, Editor, MarkdownView } from 'obsidian';

export default class Threshold extends Plugin {
	// Define object type for last clicked image
	clickedImage: {
		element: HTMLElement;
		src: string | null;
		timestamp: number;  // Guards against timing issues by ensuring contextmenu was true recently
	} | null = null;

	// Determines whether right-clicked file is a valid image type
	isImage(file: TFile | null): boolean {
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

		if (file) {
			const extension = file.extension.toLowerCase();
			if (extension && supportedExtensions.has(extension)) return true;
		}

		return false;
	}

	// Get image file when a image is right-clicked inside of a note
	async getImageFile(src: string): Promise<TFile | null> {
		const url = new URL(src);  // Obsidian uses paths like app://local/absolute/path/*.png
		const path = decodeURIComponent((url.pathname));  // Strip protocol prefix and decode it

		const allFiles = this.app.vault.getFiles();
		return allFiles.find(file => path.endsWith(file.path)) ?? null;  // Return image file or null
	}


	async onload() {
		// Allows for right click in file explorer
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu: Menu, file: TFile) => {
				if (this.isImage(file)) {
					menu.addSeparator();

					menu.addItem((item) => {
						item
							.setTitle("Apply threshold")
							.setIcon("image")
							.onClick(() => {
								new ThresholdModal(this.app, this, file).open();
							});
					})
				}
			})
		);

		// Allows for right click on rendered images in the editor
		this.registerDomEvent(document, 'contextmenu', (mouseEvent: MouseEvent) => {
			const target = mouseEvent.target as HTMLElement;

			if (target.tagName !== 'IMG') return;

			this.clickedImage = {
				element: target,
				src: target.getAttribute('src'),
				timestamp: Date.now()
			};
		}, true);

		// Add "Apply threshold" option when image was recently clicked
		this.registerEvent(
			this.app.workspace.on('editor-menu', (menu: Menu, editor: Editor, view: MarkdownView) => {
				const imageSnapshot = this.clickedImage;
				this.clickedImage = null;  // Wipe clicked image after the menu gets built

				// Only attach "Apply threshold" menu option if an image was clicked in recent time (500 ms)
				if (imageSnapshot && Date.now() - imageSnapshot.timestamp < 500) {
					const file = this.app.workspace.getActiveFile();

					if (!file) return;

					menu.addSeparator();

					menu.addItem((item) => {
						item
							.setTitle("Apply threshold")
							.setIcon("image")
							.onClick(async () => {
								if (imageSnapshot.src) {
									const imageFile = await this.getImageFile(imageSnapshot.src);
									if (imageFile) new ThresholdModal(this.app, this, imageFile).open();
								}
							});
					})
				}
			})
		)
	}
}

export class ThresholdModal extends Modal {
	constructor(app: App, private plugin: Threshold, private file: TFile) {
		super(app);
	}

	// Once the DOM is ready, apply its content
	onOpen() {
		this.modalEl.addClass("threshold-modal");
		this.titleEl.setText("Applying threshold filter");

		// Create image preview with the right-clicked image
		this.contentEl.createEl("img", {
			attr: { src: this.app.vault.getResourcePath(this.file) },
			cls: "threshold-modal-preview-image"
		});

		// Threshold filter's brightness cutoff slider / number inputs
		const sliderRowDiv = this.contentEl.createDiv({ cls: "threshold-modal-input-row-div" });
		sliderRowDiv.createEl("b", { text: "Brightness cutoff: " })
		const sliderInput = sliderRowDiv.createEl("input", {
			cls: "threshold-modal-slider",
			attr: {
				type: "range",
				min: "0",
				max: "255",
				value: "128"
			}
		});
		const numberInput = sliderRowDiv.createEl("input", {
			cls: "threshold-modal-number-input",
			attr: {
				type: "number",
				min: "0",
				max: "255",
				value: "128"
			}
		});

		// Ensure that number input's value matches slider's value
		sliderInput.addEventListener("input", () => {
			numberInput.value = sliderInput.value;
		});

		// Ensure that slider's value matches number input's value
		numberInput.addEventListener("input", () => {
			const clamped = Math.min(255, Math.max(0, Number(numberInput.value)));
			sliderInput.value = clamped.toString();
			numberInput.value = clamped.toString();
		});

		// Input field for output file's name
		const nameInputRowDiv = this.contentEl.createDiv({ cls: "threshold-modal-input-row-div" });
		nameInputRowDiv.createEl("b", { text: "Output file: ", });
		nameInputRowDiv.createEl("input", {
			type: "text",
			value: this.file.name,
			cls: "threshold-modal-input"
		});

		const applyButton = this.contentEl.createEl("button", {
			text: "Apply",
			cls: "threshold-modal-apply-button"
		});
	}

	// Clean up to avoid memory leaks
	onClose(): void {
		this.contentEl.empty();
	}
}