import { Modal } from 'obsidian';
import type SimpleVaultStatistics from './main';
import { SimpleVaultStatisticsSettings } from './settings';
import { scanVault } from './scanner';
import { VaultCounts } from './scanner';

export class StatisticsModal extends Modal {
	private readonly plugin: SimpleVaultStatistics;
	private scanAbortController = new AbortController();

	private readonly rescan = (): void => {
		void this.scanAndShowStatistics();
	};

	constructor(plugin: SimpleVaultStatistics) {
		super(plugin.app);
		this.plugin = plugin;
		this.contentEl.addClass('simple-statistics-modal');
	}

	override async onOpen(): Promise<void> {
		this.plugin.settingsChanged.addListener(this.rescan);

		await this.scanAndShowStatistics();
	}

	override onClose(): void {
		this.plugin.settingsChanged.removeListener(this.rescan);
		this.scanAbortController.abort();
		this.contentEl.empty();
	}

	private async scanAndShowStatistics(): Promise<void> {
		this.scanAbortController.abort();
		this.scanAbortController = new AbortController();

		// Placeholder for if the scan takes a long time.
		// Shown on a rescan too, so that a settings change visibly registers immediately.
		this.contentEl.empty();
		this.setContent('Loading...');

		const statistics = await scanVault(this.app, this.plugin.settings, this.scanAbortController.signal);

		// Null means this scan was abandoned: the modal was closed, or a newer scan replaced it.
		if (statistics !== null) {
			this.showStatistics(statistics);
		}
	}

	private showStatistics(vaultCounts: VaultCounts): void {
		this.contentEl.empty(); // Clear placeholder
		this.setContent(this.buildStatisticsContent(this.plugin.settings, vaultCounts));
	}

	buildStatisticsContent(settings: SimpleVaultStatisticsSettings, vaultCounts: VaultCounts): DocumentFragment {
		const lines: string[] = [];
		const addLine = (enabled: boolean, count: number, singular: string, plural: string): void => {
			if (enabled) {
				lines.push(`${count.toLocaleString()} ${count === 1 ? singular : plural}`);
			}
		};

		addLine(settings.showNotesCount, vaultCounts.notes, 'note', 'notes');
		addLine(settings.showWordCount, vaultCounts.words, 'word', 'words');
		addLine(settings.showCharacterCount, vaultCounts.characters, 'character', 'characters');
		addLine(settings.showFoldersCount, vaultCounts.folders, 'folder', 'folders');
		addLine(settings.showOtherFilesCount, vaultCounts.otherFiles, 'other file', 'other files');
		addLine(settings.showLinksCount, vaultCounts.links, 'link', 'links');
		addLine(settings.showTagsCount, vaultCounts.tags, 'tag', 'tags');
		addLine(
			settings.showCheckedCheckboxesCount,
			vaultCounts.checkedCheckboxes,
			'checked checkbox',
			'checked checkboxes',
		);

		return createFragment((content) => {
			if (settings.showVaultName) {
				content.createEl('h5', { text: this.plugin.app.vault.getName() });
			}

			for (const line of lines) {
				content.createDiv({ text: line });
			}

			if (!settings.showVaultName && lines.length === 0) {
				content.createDiv({
					text: 'ඞ',
				});
			}
		});
	}
}
