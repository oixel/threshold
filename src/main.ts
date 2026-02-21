import { Plugin, Menu, TFile, Editor, MarkdownView } from 'obsidian';
import { ThresholdModal } from 'ThresholdModal';

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

/*
No, `!important` is generally considered a code smell — it's a blunt workaround rather than a real fix, and it makes styles harder to maintain and override later.

The better approach is to inspect the button in dev tools and find the exact selector Obsidian is using to style it, then match or beat its specificity naturally. For example if Obsidian is using `.modal button`, you could use `.threshold-modal .modal-content button.threshold-modal-apply-button` which is more specific without needing `!important`.

It's also worth checking that your `styles.css` is actually being loaded at all — add a obviously wrong style like `background-color: red` and see if it applies. If nothing changes at all, the file may not be getting picked up, which would explain why none of your button styles are working regardless of what you write.
*/