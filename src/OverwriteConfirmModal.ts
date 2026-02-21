import { Modal, App } from 'obsidian';

// Modal to ensure user is okay with overwriting a file with the same output name
export class OverwriteConfirmModal extends Modal {
    constructor(app: App, private onConfirm: () => void) {
        super(app);
    }

    onOpen() {
        this.titleEl.setText("File already exists");
        this.contentEl.createEl("p", { text: "A file with this name already exists. Are you sure you wish to overwrite it?" });

        const buttonRow = this.contentEl.createDiv({ cls: ".threshold-modal-row-div" });

        // Confirm overwrite button calls apply threshold method in the ThresholdModal
        buttonRow.createEl("button", {
            text: "Overwrite",
            cls: "threshold-modal-overwrite-button"
        }).addEventListener("click", () => {
            this.onConfirm();
            this.close();
        });

        buttonRow.createEl("button", { text: "Cancel" }).addEventListener("click", () => {
            this.close();
        });
    }
}