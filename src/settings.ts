import { App, PluginSettingTab, SettingDefinitionItem } from 'obsidian';
import SimpleVaultStatistics from './main';

export interface SimpleVaultStatisticsSettings {
	showVaultName: boolean;
	showNotesCount: boolean;
	showWordCount: boolean;
	showCharacterCount: boolean;
	txtFilesCountAsNotes: boolean;
	showFoldersCount: boolean;
	showOtherFilesCount: boolean;
	showInternalLinksCount: boolean;
	showExternalLinksCount: boolean;
	showTagsCount: boolean;
	showCheckedCheckboxesCount: boolean;
}

export const DEFAULT_SETTINGS: SimpleVaultStatisticsSettings = {
	showVaultName: true,
	showNotesCount: true,
	showWordCount: true,
	showCharacterCount: false,
	txtFilesCountAsNotes: false,
	showFoldersCount: false,
	showOtherFilesCount: true,
	showInternalLinksCount: false,
	showExternalLinksCount: false,
	showTagsCount: false,
	showCheckedCheckboxesCount: false,
};

export class SimpleVaultStatisticsSettingsTab extends PluginSettingTab {
	plugin: SimpleVaultStatistics;

	constructor(app: App, plugin: SimpleVaultStatistics) {
		super(app, plugin);
		this.plugin = plugin;
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		await super.setControlValue(key, value);
		this.plugin.settingsChanged.invoke();
	}

	getSettingDefinitions(): SettingDefinitionItem<keyof SimpleVaultStatisticsSettings>[] {
		return [
			{
				name: 'Show vault name',
				control: {
					type: 'toggle',
					key: 'showVaultName',
				},
			},
			{
				name: 'Show notes count',
				control: {
					type: 'toggle',
					key: 'showNotesCount',
				},
			},
			{
				name: 'Show word count',
				control: {
					type: 'toggle',
					key: 'showWordCount',
				},
			},
			{
				name: 'Show character count',
				control: {
					type: 'toggle',
					key: 'showCharacterCount',
				},
			},
			{
				name: 'Count .txt files as notes',
				desc: 'If enabled, .txt files will be counted in "note count" instead of "other files count", and their contents will contribute to the word count and character count.',
				control: {
					type: 'toggle',
					key: 'txtFilesCountAsNotes',
				},
			},
			{
				name: 'Show folders count',
				control: {
					type: 'toggle',
					key: 'showFoldersCount',
				},
			},
			{
				name: 'Show other files count',
				control: {
					type: 'toggle',
					key: 'showOtherFilesCount',
				},
			},
			{
				name: 'Show internal links count',
				control: {
					type: 'toggle',
					key: 'showInternalLinksCount',
				},
			},
			{
				name: 'Show external links count',
				control: {
					type: 'toggle',
					key: 'showExternalLinksCount',
				},
			},
			{
				name: 'Show tags count',
				control: {
					type: 'toggle',
					key: 'showTagsCount',
				},
			},
			{
				name: 'Show checked checkboxes count',
				control: {
					type: 'toggle',
					key: 'showCheckedCheckboxesCount',
				},
			},
		];
	}
}
