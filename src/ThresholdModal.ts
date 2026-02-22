import { TFile, Modal, App, Notice, MarkdownView } from 'obsidian';
import { OverwriteConfirmModal } from 'OverwriteConfirmModal';

export class ThresholdModal extends Modal {
    constructor(app: App, private file: TFile) {
        super(app);
    }

    // Once the DOM is ready, apply its content
    onOpen() {
        this.modalEl.addClass("threshold-modal");
        this.titleEl.setText("Apply threshold filter");

        // Create image preview with the right-clicked image
        const img = this.contentEl.createEl("img", {
            attr: { src: this.app.vault.getResourcePath(this.file) },
            cls: "threshold-modal-preview-image"
        });

        const canvas = this.contentEl.createEl("canvas", { cls: "threshold-modal-canvas" });
        const context = canvas.getContext("2d")!;  // context is certain

        let cleanImageData: ImageData;

        img.addEventListener("load", () => {
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;

            // Draw the preview image onto the hidden Canvas element
            context?.drawImage(img, 0, 0);
            cleanImageData = context.getImageData(0, 0, canvas.width, canvas.height);

            // Automatically apply basic threshold filter to image
            previewThreshold(128);
        }, { once: true });

        // Render the applied threshold filter to the preview image
        const previewThreshold = (cutoff: number) => {
            // Avoid applying threshold if the image has not been loaded
            if (!cleanImageData) return;

            // Create a new pixel data array to avoid overwriting the original image's
            const imageData = new ImageData(
                new Uint8ClampedArray(cleanImageData.data),
                cleanImageData.width,
                cleanImageData.height
            );
            const data = imageData.data

            // Check for pixel luminance and apply threshold to every pixel in the image that is greater than the cutoff
            for (let i = 0; i < data.length; i += 4) {
                // Grab pixel's RGB values (if present or default to 0 if not)
                const r = data[i] ?? 0;
                const g = data[i + 1] ?? 0;
                const b = data[i + 2] ?? 0;

                // Equation for converting a RGB value to its perceived luminance
                // Source: https://stackoverflow.com/a/596243
                const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

                // If pixel's luminance is greater than the brightness cutoff, apply the filter to it!
                const output = luminance >= cutoff ? 255 : 0;
                data[i] = data[i + 1] = data[i + 2] = output;
            }

            // Apply changes to the image
            context.putImageData(imageData, 0, 0);
            img.src = canvas.toDataURL();
        }

        // Threshold filter's brightness cutoff slider
        const sliderRowDiv = this.contentEl.createDiv({ cls: "threshold-modal-row-div" });
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

        // Numerical input field whose value is tied to the slider's, allowing for precise control
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
            previewThreshold(Number(sliderInput.value));
        });

        // Ensure that slider's value matches number input's value
        numberInput.addEventListener("input", () => {
            const clamped = Math.min(255, Math.max(0, Number(numberInput.value)));
            sliderInput.value = clamped.toString();
            numberInput.value = clamped.toString();
            previewThreshold(clamped);
        });

        // Input field for output file's name
        const nameInputRowDiv = this.contentEl.createDiv({ cls: "threshold-modal-row-div" });
        nameInputRowDiv.createEl("b", { text: "Output name: " });
        const nameInput = nameInputRowDiv.createEl("input", {
            type: "text",
            value: this.file.basename,
            cls: "threshold-modal-input"
        });

        // Takes current canvas image and overwrites/creates an actual image file from it
        const applyThreshold = (fileExists: boolean, filePath: string) => {
            // Create an image blob object from the image contained within the canvas element
            canvas.toBlob((blob) => {
                if (!blob) return;

                // Set up FileReader to read the canvas image's data blob
                const reader = new FileReader();

                // onload gets called after reader finishes reading (following reader.readAsArrayBuffer())
                reader.onload = async () => {
                    // Obsidian's modify/createBinary() methods require type of ArrayBuffer
                    const buffer = reader.result as ArrayBuffer;

                    // Overwrite or create new image depending on if the filename already exists
                    if (fileExists) {
                        await this.app.vault.modifyBinary(this.file, buffer);

                        // Refresh the note after image gets modified
                        const leaf = this.app.workspace.getMostRecentLeaf();
                        if (leaf) {
                            // Append rebuildView functionality to leaf as it is a private Obsidian method and hidden from the public API
                            const rebuildLeaf = leaf as typeof leaf & { rebuildView: () => Promise<void> };
                            await rebuildLeaf.rebuildView();  // Refresh the note!
                        }

                        new Notice("Applied threshold to original image.");
                    }
                    else {
                        const newFile = await this.app.vault.createBinary(filePath, buffer);

                        const activeFile = this.app.workspace.getActiveFile();
                        if (activeFile) {
                            const content = await this.app.vault.read(activeFile);
                            const imageCount = content.match(new RegExp(this.file.name, 'g'));

                            const updated = content.replaceAll(this.file.name, newFile.name);
                            await this.app.vault.modify(activeFile, updated);

                            new Notice(`Created new image with threshold applied: ${newFile.name}`);

                            // Warn user if multiple instances of this image get replaced
                            if (imageCount && imageCount.length > 1) new Notice("Multiple instances of this image found in this note. All links have been updated.");
                        }
                    }

                    this.close();  // Exit the threshold modal when done
                }

                // Converts canvas image's data blob into an ArrayBuffer
                reader.readAsArrayBuffer(blob);
            }, `image/${this.file.extension.toLowerCase()}`);
        };

        this.contentEl.createEl("button", {
            text: "Apply",
            cls: "threshold-modal-apply-button"
        }).addEventListener("click", () => {
            void (async () => {
                // Determine file path of right-clicked image's source
                const folder = this.file.parent?.path;
                const filename = `${nameInput.value}.${this.file.extension}`
                const path = (folder && folder !== '/') ? `${folder}/${filename}` : filename;
                const file = this.app.vault.getFileByPath(path);

                // If file with name already exists, then warn user before overwriting it
                if (file) new OverwriteConfirmModal(this.app, () => applyThreshold(true, path)).open();
                else applyThreshold(false, path);
            })();
        });
    }

    // Clean up to avoid memory leaks
    onClose(): void {
        this.contentEl.empty();
    }
}