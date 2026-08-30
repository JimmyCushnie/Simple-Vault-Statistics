import { App, CachedMetadata, TFile, Vault, parseFrontMatterTags } from 'obsidian';
import { SimpleVaultStatisticsSettings } from './settings';
import { countExternalLinks } from './external-links';

/**
 * How many notes to read from disk at once. Reads are I/O bound, so overlapping them is a
 * large win over reading one at a time, but an unbounded pool just thrashes the disk and
 * balloons memory on a vault with tens of thousands of notes.
 */
const READ_BATCH_SIZE = 16;

/**
 * How many notes to process at once when no reads are needed. Nothing in that case touches
 * the disk, so the batch exists only to pace the clock checks below; a small batch would
 * make `performance.now()` a measurable share of the pass.
 */
const METADATA_BATCH_SIZE = 512;

/**
 * How long the scan may hold the main thread before handing it back. Keeps a scan of a large
 * vault from freezing the app.
 */
const MAX_MAIN_THREAD_HOLD_MS = 100;

export interface VaultCounts {
	notes: number;
	words: number;
	characters: number;
	otherFiles: number;
	folders: number;
	internalLinks: number;
	externalLinks: number;
	footnotes: number;
	tags: number;
	checkedCheckboxes: number;
	uncheckedCheckboxes: number;
}

/**
 * Scans the whole vault and calculates every statistic enabled in `settings`.
 *
 * Resolves to `null` if `signal` was aborted before the scan finished.
 */
export async function scanVault(
	app: App,
	settings: SimpleVaultStatisticsSettings,
	signal: AbortSignal,
): Promise<VaultCounts | null> {
	const stats: VaultCounts = {
		notes: 0,
		words: 0,
		characters: 0,
		otherFiles: 0,
		folders: 0,
		internalLinks: 0,
		externalLinks: 0,
		footnotes: 0,
		tags: 0,
		checkedCheckboxes: 0,
		uncheckedCheckboxes: 0,
	};

	if (settings.showFoldersCount) {
		stats.folders = app.vault.getAllFolders(false).length;
	}

	const notes = getNotesAndCountFiles(app.vault, settings, stats);
	await scanNotes(app, settings, notes, stats, signal);

	return signal.aborted ? null : stats;
}

function getNotesAndCountFiles(vault: Vault, settings: SimpleVaultStatisticsSettings, stats: VaultCounts): TFile[] {
	const notes: TFile[] = [];
	const txtCountsAsNote = settings.txtFilesCountAsNotes;
	let otherFiles = 0;

	for (const file of vault.getFiles()) {
		const extension = file.extension;
		if (extension === 'md' || (txtCountsAsNote && extension === 'txt')) {
			notes.push(file);
		} else {
			otherFiles++;
		}
	}

	stats.notes = notes.length;
	stats.otherFiles = otherFiles;
	return notes;
}

/**
 * Walks every note in batches, collecting whichever statistics need per-note work. Returns
 * early if `signal` is aborted, leaving `stats` holding a partial count.
 *
 * The batch is the unit of both concurrency and responsiveness: reads within a batch overlap,
 * and between batches the scan hands the main thread back if it has held it too long.
 */
async function scanNotes(
	app: App,
	settings: SimpleVaultStatisticsSettings,
	notes: TFile[],
	stats: VaultCounts,
	signal: AbortSignal,
): Promise<void> {
	const needsContent = settings.showWordCount || settings.showCharacterCount || settings.showExternalLinksCount;

	const batchSize = needsContent ? READ_BATCH_SIZE : METADATA_BATCH_SIZE;
	let mainThreadHeldMs = 0;

	for (let batchStart = 0; batchStart < notes.length; batchStart += batchSize) {
		const batch = notes.slice(batchStart, batchStart + batchSize);
		const contents = needsContent ? await Promise.all(batch.map((note) => readNote(app.vault, note))) : null;
		async function readNote(vault: Vault, note: TFile): Promise<string | null> {
			try {
				return await vault.cachedRead(note);
			} catch {
				return null;
			}
		}

		const countingStartedAt = performance.now();
		for (const [i, note] of batch.entries()) {
			const cache = app.metadataCache.getFileCache(note);
			if (cache !== null) countStatisticsFromMetadata(cache, settings, stats);

			const content = contents?.[i] ?? null;
			if (content !== null) {
				if (settings.showCharacterCount) {
					stats.characters += content.length;
				}
				if (settings.showWordCount) {
					const bodyStart = cache?.frontmatterPosition?.end.offset ?? 0;
					stats.words += countWords(content, bodyStart);
				}
				if (settings.showExternalLinksCount) {
					stats.externalLinks += countExternalLinks(content, note.extension === 'md' ? cache : null);
				}
			}
		}
		mainThreadHeldMs += performance.now() - countingStartedAt;

		if (signal.aborted) {
			return;
		}

		// The reason we don't just do all this work on a separate thread is that the Obsidian
		// APIs we use here only work on the main thread.
		if (mainThreadHeldMs >= MAX_MAIN_THREAD_HOLD_MS) {
			await yieldToEventLoop();
			mainThreadHeldMs = 0;
		}
	}
}

function countStatisticsFromMetadata(
	cache: CachedMetadata,
	settings: SimpleVaultStatisticsSettings,
	stats: VaultCounts,
): void {
	if (settings.showInternalLinksCount) {
		stats.internalLinks += cache.links?.length ?? 0;
		stats.internalLinks += cache.frontmatterLinks?.length ?? 0;
		stats.internalLinks += cache.embeds?.length ?? 0;
	}

	if (settings.showFootnotesCount) {
		stats.footnotes += cache.footnotes?.length ?? 0;
	}

	if (settings.showTagsCount) {
		stats.tags += cache.tags?.length ?? 0;
		stats.tags += parseFrontMatterTags(cache.frontmatter ?? null)?.length ?? 0;
	}

	if (
		(settings.showCheckedCheckboxesCount || settings.showUncheckedCheckboxesCount) &&
		cache.listItems !== undefined
	) {
		for (const item of cache.listItems) {
			// `task` is undefined for plain list items and `' '` for an unchecked box. Every
			// other marker ([x], [-], [/], ...) is a checked box.
			if (item.task === undefined) continue;
			if (item.task === ' ') {
				if (settings.showUncheckedCheckboxesCount) stats.uncheckedCheckboxes++;
			} else {
				if (settings.showCheckedCheckboxesCount) stats.checkedCheckboxes++;
			}
		}
	}
}

/** Hands the main thread back to Obsidian for one turn of the event loop. */
function yieldToEventLoop(): Promise<void> {
	// Puts a 0ms timer at the end of the task queue.
	// This frees the main thread and lets Obsidian execute its other queued tasks (paint the
	// window, handle clicks, etc) for one cycle of the event loop before we continue the scan.
	return new Promise((resolve) => {
		window.setTimeout(resolve, 0);
	});
}

/**
 * Counts whitespace-separated words in `text`, starting at `start`.
 */
function countWords(text: string, start: number): number {
	// This function runs on every single character in every single note in the vault so it has
	// to be really fast.
	// Don't make changes without measuring performance!

	const length = text.length;
	let count = 0;

	// Start as true so a word beginning at `start` is counted.
	let previousWasSpace = 1;

	for (let i = start; i < length; i++) {
		const code = text.charCodeAt(i);
		const isSpace = code < 0x80 ? (ASCII_WHITESPACE[code] as number) : rareWhitespace(code);

		// Branchless version of `if (previousWasSpace && !isSpace) count++`. Word boundaries
		// are irregular, so a branch here will usually mispredict.
		count += previousWasSpace & (1 - isSpace);

		previousWasSpace = isSpace;
	}

	return count;
}

// Notes are almost completely ASCII, so we use a very fast lookup table where possible.
// Return a number rather than a boolean to prevent a type conversion in the logic above.
const ASCII_WHITESPACE = new Uint8Array(0x80);
for (const code of [0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x20]) {
	ASCII_WHITESPACE[code] = 1;
}

function rareWhitespace(code: number): number {
	const isWhitespace =
		code === 0x85 ||
		code === 0xa0 ||
		code === 0x1680 ||
		(code >= 0x2000 && code <= 0x200a) ||
		code === 0x2028 ||
		code === 0x2029 ||
		code === 0x202f ||
		code === 0x205f ||
		code === 0x3000 ||
		code === 0xfeff;

	return isWhitespace ? 1 : 0;
}
