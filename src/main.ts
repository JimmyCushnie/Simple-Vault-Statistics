import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, SimpleVaultStatisticsSettings, SimpleVaultStatisticsSettingsTab } from './settings';
import { StatisticsModal } from './statistics-modal';
import { Event } from './event';

export default class SimpleVaultStatistics extends Plugin {
	settings!: SimpleVaultStatisticsSettings;

	readonly settingsChanged = new Event();

	async onload() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<SimpleVaultStatisticsSettings>,
		);

		this.addSettingTab(new SimpleVaultStatisticsSettingsTab(this.app, this));

		this.addRibbonIcon('chart-column', 'Show vault statistics', (_evt: MouseEvent) => {
			new StatisticsModal(this).open();
		});

		this.addCommand({
			id: 'show-vault-statistics',
			name: 'Show vault statistics',
			callback: () => {
				new StatisticsModal(this).open();
			},
		});
	}
}
