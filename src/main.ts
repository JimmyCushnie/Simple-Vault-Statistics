import { App, Editor, MarkdownView, MarkdownFileInfo, Modal, Notice, Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, SimpleVaultStatisticsSettings, SimpleVaultStatisticsSettingsTab } from './settings';

export default class SimpleVaultStatistics extends Plugin {
	settings!: SimpleVaultStatisticsSettings;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new SimpleVaultStatisticsSettingsTab(this.app, this));

		this.addRibbonIcon('chart-column', 'Open vault statistics', (_evt: MouseEvent) => {
			new StatisticsModal(this.app).open();
		});

		this.addCommand({
			id: 'open-vault-statistics',
			name: 'Open vault statistics',
			callback: () => {
				new StatisticsModal(this.app).open();
			},
		});
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<SimpleVaultStatisticsSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class StatisticsModal extends Modal {
	constructor(app: App) {
		super(app);
		this.setContent('Modal content goes here');
	}
}
