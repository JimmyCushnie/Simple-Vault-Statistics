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
	showFootnotesCount: boolean;
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
	showFootnotesCount: false,
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
				desc: 'Shows the name of your vault as a small header above the statistics.',
				control: {
					type: 'toggle',
					key: 'showVaultName',
				},
			},
			{
				name: 'Show notes count',
				desc: 'Shows the total number of notes in your vault.',
				control: {
					type: 'toggle',
					key: 'showNotesCount',
				},
			},
			{
				name: 'Show word count',
				desc: 'Shows the total number of words in all the notes in your vault. Does not count words in frontmatter blocks.',
				control: {
					type: 'toggle',
					key: 'showWordCount',
				},
			},
			{
				name: 'Show character count',
				desc: 'Shows the total number of characters in all the notes in your vault, including characters in frontmatter blocks.',
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
				desc: 'Shows the total number of folders in your vault.',
				control: {
					type: 'toggle',
					key: 'showFoldersCount',
				},
			},
			{
				name: 'Show other files count',
				desc: 'Shows the total number of non-note files in your vault, such as images, PDFs, and canvases.',
				control: {
					type: 'toggle',
					key: 'showOtherFilesCount',
				},
			},
			{
				name: 'Show internal links count',
				desc: 'Shows the total number of links in all the notes in your vault that point to other files in your vault.',
				control: {
					type: 'toggle',
					key: 'showInternalLinksCount',
				},
			},
			{
				name: 'Show external links count',
				desc: 'Shows the total number of links in all the notes in your vault that point outside your vault, such as web URLs.',
				control: {
					type: 'toggle',
					key: 'showExternalLinksCount',
				},
			},
			{
				name: 'Show footnotes count',
				desc: 'Shows the total number of footnotes in all the notes in your vault.',
				control: {
					type: 'toggle',
					key: 'showFootnotesCount',
				},
			},
			{
				name: 'Show tags count',
				desc: 'Shows the total number of times a note has been given a tag.',
				control: {
					type: 'toggle',
					key: 'showTagsCount',
				},
			},
			{
				name: 'Show checked checkboxes count',
				desc: 'Shows the total number of checked checkboxes in all the notes in your vault.',
				control: {
					type: 'toggle',
					key: 'showCheckedCheckboxesCount',
				},
			},
		];
	}
}
