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
		const stats: { count: number; labelSingular: string; labelPlural: string }[] = [];
		const addStat = (enabled: boolean, count: number, singular: string, plural: string): void => {
			if (enabled) {
				stats.push({ count: count, labelSingular: singular, labelPlural: plural });
			}
		};

		addStat(settings.showNotesCount, vaultCounts.notes, 'note', 'notes');
		addStat(settings.showWordCount, vaultCounts.words, 'word', 'words');
		addStat(settings.showCharacterCount, vaultCounts.characters, 'character', 'characters');
		addStat(settings.showFoldersCount, vaultCounts.folders, 'folder', 'folders');
		addStat(settings.showOtherFilesCount, vaultCounts.otherFiles, 'other file', 'other files');
		addStat(settings.showInternalLinksCount, vaultCounts.internalLinks, 'internal link', 'internal links');
		addStat(settings.showExternalLinksCount, vaultCounts.externalLinks, 'external link', 'external links');
		addStat(settings.showFootnotesCount, vaultCounts.footnotes, 'footnote', 'footnotes');
		addStat(settings.showTagsCount, vaultCounts.tags, 'tag', 'tags');
		addStat(
			settings.showCheckedCheckboxesCount,
			vaultCounts.checkedCheckboxes,
			'checked checkbox',
			'checked checkboxes',
		);
		addStat(
			settings.showUncheckedCheckboxesCount,
			vaultCounts.uncheckedCheckboxes,
			'unchecked checkbox',
			'unchecked checkboxes',
		);

		return createFragment((content) => {
			if (settings.showVaultName) {
				content.createEl('h5', { text: this.plugin.app.vault.getName() });
			}

			if (stats.length > 0) {
				switch (settings.displayStyle) {
					case 'simple':
					default:
						for (const stat of stats) {
							content.createDiv({
								text: `${stat.count.toLocaleString()} ${stat.count === 1 ? stat.labelSingular : stat.labelPlural}`,
							});
						}
						break;

					case 'aligned':
						{
							const linesParent = content.createDiv({ cls: 'simple-statistics-aligned-parent' });
							for (const stat of stats) {
								linesParent.createSpan({
									attr: { style: 'text-align: right' },
									text: stat.count.toLocaleString(),
								});
								linesParent.createSpan({
									attr: { style: 'text-align: left' },
									text: stat.count === 1 ? stat.labelSingular : stat.labelPlural,
								});
							}
						}
						break;

					case 'tableWithAveragesPerNote':
						{
							const wrapper = content.createDiv({ cls: 'markdown-rendered' }); // Uses Obsidian's standard table css
							const table = wrapper.createEl('table', { attr: { style: 'margin: 0 auto' } });
							const tbody = table.createEl('tbody');

							const headerRow = tbody.createEl('tr');
							headerRow.createEl('th', { text: 'Thing' });
							headerRow.createEl('th', { text: 'Count', attr: { align: 'right' } });
							headerRow.createEl('th', { text: 'Average per note', attr: { align: 'right' } });

							for (const stat of stats) {
								const row = tbody.createEl('tr');
								row.createEl('td', { text: stat.labelPlural });
								row.createEl('td', { text: stat.count.toLocaleString(), attr: { align: 'right' } });
								row.createEl('td', {
									text: vaultCounts.notes > 0 ? (stat.count / vaultCounts.notes).toFixed(2) : '0.00',
									attr: { align: 'right' },
								});
							}
						}
						break;
				}
			}

			if (!settings.showVaultName && stats.length === 0) {
				content.createDiv({
					text: 'ඞ',
				});
			}
		});
	}
}
