import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, SimpleVaultStatisticsSettings, SimpleVaultStatisticsSettingsTab } from './settings';
import { StatisticsModal } from './statistics-modal';
import { Event } from './event';

export default class SimpleVaultStatistics extends Plugin {
	settings!: SimpleVaultStatisticsSettings;

	readonly settingsChanged = new Event();

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new SimpleVaultStatisticsSettingsTab(this.app, this));

		this.addRibbonIcon('chart-column', 'Open vault statistics', (_evt: MouseEvent) => {
			new StatisticsModal(this).open();
		});

		this.addCommand({
			id: 'open-vault-statistics',
			name: 'Open vault statistics',
			callback: () => {
				new StatisticsModal(this).open();
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
