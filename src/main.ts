import { Plugin, Menu, TFile } from 'obsidian';
import { ThresholdModal } from 'ThresholdModal';

export default class Threshold extends Plugin {
	// Define object type for last clicked image
	clickedImage: {
		element: HTMLElement;
		src: string | null;
		timestamp: number;  // Guards against timing issues by ensuring contextmenu was true recently,
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
	getImageFile(src: string): TFile | null {
		const url = new URL(src);  // Obsidian uses paths like app://local/absolute/path/*.png
		const path = decodeURIComponent((url.pathname));  // Strip protocol prefix and decode it

		const allFiles = this.app.vault.getFiles();
		return allFiles.find(file => path.endsWith(file.path)) ?? null;  // Return image file or null
	}


	onload() {
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
								new ThresholdModal(this.app, file).open();
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
			this.app.workspace.on('editor-menu', (menu: Menu) => {
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
							.onClick(() => {
								if (imageSnapshot.src) {
									const imageFile = this.getImageFile(imageSnapshot.src);
									if (imageFile) new ThresholdModal(this.app, imageFile).open();
								}
							});
					})
				}
			})
		)
	}
}
