import { App, PluginSettingTab, SettingDefinitionItem } from 'obsidian';
import SimpleVaultStatistics from './main';

export interface SimpleVaultStatisticsSettings {
	showVaultName: boolean;
	showNotesCount: boolean;
	showWordCount: boolean;
	showCharacterCount: boolean;
	txtFilesCountAsNotes: boolean;
	showOtherFilesCount: boolean;
	showFoldersCount: boolean;
	showLinksCount: boolean;
	showTagsCount: boolean;
	showCheckedCheckboxesCount: boolean;
}

export const DEFAULT_SETTINGS: SimpleVaultStatisticsSettings = {
	showVaultName: true,
	showNotesCount: true,
	showWordCount: true,
	showCharacterCount: false,
	txtFilesCountAsNotes: false,
	showOtherFilesCount: true,
	showFoldersCount: false,
	showLinksCount: false,
	showTagsCount: false,
	showCheckedCheckboxesCount: false,
};

export class SimpleVaultStatisticsSettingsTab extends PluginSettingTab {
	plugin: SimpleVaultStatistics;

	constructor(app: App, plugin: SimpleVaultStatistics) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem<keyof SimpleVaultStatisticsSettings>[] {
		return [
			{
				name: 'Show Vault Name',
				control: {
					type: 'toggle',
					key: 'showVaultName',
				},
			},
			{
				name: 'Show Notes Count',
				control: {
					type: 'toggle',
					key: 'showNotesCount',
				},
			},
			{
				name: 'Show Word Count',
				control: {
					type: 'toggle',
					key: 'showWordCount',
				},
			},
			{
				name: 'Show Character Count',
				control: {
					type: 'toggle',
					key: 'showCharacterCount',
				},
			},
			{
				name: 'Count .txt Files As Notes',
				desc: 'If enabled, .txt files will be counted in "note count" instead of "other files count", and their contents will contribute to the word count and character count.',
				control: {
					type: 'toggle',
					key: 'txtFilesCountAsNotes',
				},
			},
			{
				name: 'Show Other Files Count',
				control: {
					type: 'toggle',
					key: 'showOtherFilesCount',
				},
			},
			{
				name: 'Show Folders Count',
				control: {
					type: 'toggle',
					key: 'showFoldersCount',
				},
			},
			{
				name: 'Show Links Count',
				control: {
					type: 'toggle',
					key: 'showLinksCount',
				},
			},
			{
				name: 'Show Tags Count',
				control: {
					type: 'toggle',
					key: 'showTagsCount',
				},
			},
			{
				name: 'Show Checked Checkboxes Count',
				control: {
					type: 'toggle',
					key: 'showCheckedCheckboxesCount',
				},
			},
		];
	}
}
