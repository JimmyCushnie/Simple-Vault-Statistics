import { App, CachedMetadata, TFile, Vault, parseFrontMatterTags } from 'obsidian';
import { SimpleVaultStatisticsSettings } from './settings';

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
	links: number;
	tags: number;
	checkedCheckboxes: number;
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
		links: 0,
		tags: 0,
		checkedCheckboxes: 0,
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
	const needsContent = settings.showWordCount || settings.showCharacterCount;
	const needsMetadata = settings.showLinksCount || settings.showTagsCount || settings.showCheckedCheckboxesCount;
	if (!needsContent && !needsMetadata) {
		return;
	}

	// Reading is by far the most expensive part of a scan, so when note contents are needed
	// anyway the metadata is collected in the same pass rather than a second one.
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
			const content = contents?.[i] ?? null;

			if (content !== null) {
				const bodyStart = bodyStartOffset(cache, content);
				if (settings.showCharacterCount) {
					stats.characters += content.length;
				}
				if (settings.showWordCount) {
					stats.words += countWords(content, bodyStart);
				}
			}

			if (needsMetadata && cache !== null) {
				countStatisticsFromMetadata(cache, settings, stats);
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

/**
 * Adds one note's link, tag, and checkbox counts. These all come from Obsidian's metadata
 * cache, which is already in memory, so they cost no file reads.
 */
function countStatisticsFromMetadata(
	cache: CachedMetadata,
	settings: SimpleVaultStatisticsSettings,
	stats: VaultCounts,
): void {
	if (settings.showLinksCount) {
		stats.links += cache.links?.length ?? 0;
		stats.links += cache.embeds?.length ?? 0;
	}

	if (settings.showTagsCount) {
		stats.tags += cache.tags?.length ?? 0;
		stats.tags += parseFrontMatterTags(cache.frontmatter ?? null)?.length ?? 0;
	}

	if (settings.showCheckedCheckboxesCount && cache.listItems !== undefined) {
		for (const item of cache.listItems) {
			// `task` is undefined for plain list items and `' '` for an unchecked box. Every
			// other marker ([x], [-], [/], ...) is a checked box.
			if (item.task !== undefined && item.task !== ' ') {
				stats.checkedCheckboxes++;
			}
		}
	}
}

/**
 * Offset at which a note's body begins, skipping the frontmatter block so it does not
 * contribute to word and character counts. Returns 0 for notes without frontmatter.
 */
function bodyStartOffset(cache: CachedMetadata | null, content: string): number {
	const end = cache?.frontmatterPosition?.end.offset;
	if (end === undefined) {
		return 0;
	}

	// The cached offset lands just after the closing `---`, so step past the line break that
	// terminates it. Clamped because a stale cache can point past the end of the content.
	let offset = Math.min(end, content.length);
	if (content.charCodeAt(offset) === 0x0d) {
		offset++;
	}
	if (content.charCodeAt(offset) === 0x0a) {
		offset++;
	}
	return offset;
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
	//This deliberately avoids `split()` and regexes. On a vault with tens of thousands of
	// notes those allocate an array per note and dominate the scan. This is much faster.

	const length = text.length;
	let count = 0;
	let inWord = false;

	for (let i = start; i < length; i++) {
		if (isWhitespace(text.charCodeAt(i))) {
			inWord = false;
		} else if (!inWord) {
			inWord = true;
			count++;
		}
	}

	return count;

	function isWhitespace(code: number): boolean {
		// Almost every character in a note is ASCII, so check that range first and exit early.
		if (code < 0x80) {
			return code === 0x20 || (code >= 0x09 && code <= 0x0d);
		}

		return (
			code === 0x85 ||
			code === 0xa0 ||
			code === 0x1680 ||
			(code >= 0x2000 && code <= 0x200a) ||
			code === 0x2028 ||
			code === 0x2029 ||
			code === 0x202f ||
			code === 0x205f ||
			code === 0x3000 ||
			code === 0xfeff
		);
	}
}
