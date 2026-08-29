import type { CachedMetadata } from 'obsidian';

// Using codes for this is significantly faster than comparing strings (I measured)
const TAB = 0x09;
const CARRIAGE_RETURN = 0x0d;
const SPACE = 0x20;
const LOWER_H = 0x68;
const LOWER_T = 0x74;
const LOWER_P = 0x70;
const LOWER_S = 0x73;
const SLASH = 0x2f;

/**
 * Counts the links in one note that point outside the vault.
 *
 * `cache` is the note's metadata, or null for a plaintext (non-markdown) note.
 *
 * A `[text](destination)` link counts if `cache` is not null and does not contain an entry
 * for that link -- i.e., Obsidian did not read the link as pointing at a file in the vault,
 * so the link must be external.
 *
 * Outside of `[text](destination)` links in markdown notes, bare http:// and https:// links
 * are counted as well.
 */
export function countExternalLinks(content: string, cache: CachedMetadata | null): number {
	let linksCount = 0;
	const internalLinkStarts = cache === null ? null : findInternalLinkStarts(cache);

	// Use indexOf to find the two characters that flag a potential link. In my tests, this is
	// roughly 5x faster than iterating the chars in a loop.
	let nextBracketIndex = internalLinkStarts === null ? -1 : content.indexOf('[');
	let nextColonIndex = content.indexOf(':');

	while (nextBracketIndex !== -1 || nextColonIndex !== -1) {
		const colonComesFirst =
			internalLinkStarts === null ||
			(nextColonIndex !== -1 && (nextBracketIndex === -1 || nextColonIndex < nextBracketIndex));

		if (colonComesFirst) {
			// Scanning carries on inside the address just counted rather than stepping over it.
			// A nested link like `https://alice.com/?redirect=https://bob.com` counts as two, which
			// I guess is incorrect behavior, but I'm willing to take it to avoid code complexity.
			if (nextColonIndex !== -1 && colonIndexIsPartOfUrl(content, nextColonIndex)) {
				linksCount++;
			}
			nextColonIndex = content.indexOf(':', nextColonIndex + 1);
			continue;
		}

		const linkEnd = findMarkdownLinkEndIndex(content, nextBracketIndex);
		if (linkEnd === -1) {
			nextBracketIndex = content.indexOf('[', nextBracketIndex + 1);
			continue;
		}

		if (!isInternalLink(content, nextBracketIndex, internalLinkStarts)) {
			linksCount++;
		}

		// Resuming past the whole link, its text included, prevents
		// `[https://abc](https://abc)` from counting as two links.
		const afterLink = linkEnd + 1;
		nextBracketIndex = content.indexOf('[', afterLink);
		// The conditional here is redundant, but in my tests it improved performance ~45% for link-heavy text.
		if (nextColonIndex !== -1 && nextColonIndex < afterLink) {
			nextColonIndex = content.indexOf(':', afterLink);
		}
	}

	return linksCount;
}

/**
 * The offsets in a note where Obsidian recorded a link pointing inside the vault.
 */
function findInternalLinkStarts(cache: CachedMetadata): Set<number> {
	const starts = new Set<number>();

	for (const link of cache.links ?? []) {
		starts.add(link.position.start.offset);
	}
	for (const embed of cache.embeds ?? []) {
		starts.add(embed.position.start.offset);
	}

	return starts;
}

/**
 * Whether Obsidian recorded a link into the vault at the bracket opening at `openBracket`.
 */
function isInternalLink(text: string, openBracket: number, internalLinkStarts: ReadonlySet<number>): boolean {
	return (
		internalLinkStarts.has(openBracket) ||
		(text[openBracket - 1] === '!' && internalLinkStarts.has(openBracket - 1)) // embeds
	);
}

/**
 * Returns the index of the `)` closing the `[text](destination)` link opening at `openBracketIndex`,
 * or -1 if there is no whole link there.
 */
function findMarkdownLinkEndIndex(text: string, openBracketIndex: number): number {
	const textEnd = findClosingCharIndex(text, openBracketIndex, '[', ']');
	if (textEnd === -1 || text[textEnd + 1] !== '(') {
		return -1;
	}

	return findClosingCharIndex(text, textEnd + 1, '(', ')');
}

/**
 * Returns the index of the character closing the one at `start`, which must be an `openChar`,
 * or -1 if the line ends first. Nesting and backslash escapes in between are accounted for.
 */
function findClosingCharIndex(text: string, startIndex: number, openChar: string, closeChar: string): number {
	let depth = 0;

	for (let i = startIndex; i < text.length; i++) {
		const char = text[i];

		if (char === '\n') {
			break;
		} else if (char === '\\') {
			i++;
		} else if (char === openChar) {
			depth++;
		} else if (char === closeChar) {
			depth--;
			if (depth === 0) {
				return i;
			}
		}
	}

	return -1;
}

function colonIndexIsPartOfUrl(text: string, colon: number): boolean {
	if (text.charCodeAt(colon + 1) !== SLASH || text.charCodeAt(colon + 2) !== SLASH) {
		return false;
	}

	// count `https://A`, but do not count `https://`
	const addressStart = text.charCodeAt(colon + 3);
	if (Number.isNaN(addressStart) || isWhitespace(addressStart)) {
		return false;
	}

	const beforeColon = text.charCodeAt(colon - 1);

	if (beforeColon === LOWER_P) {
		return (
			colon >= 4 &&
			text.charCodeAt(colon - 2) === LOWER_T &&
			text.charCodeAt(colon - 3) === LOWER_T &&
			text.charCodeAt(colon - 4) === LOWER_H
		);
	}

	if (beforeColon === LOWER_S) {
		return (
			colon >= 5 &&
			text.charCodeAt(colon - 2) === LOWER_P &&
			text.charCodeAt(colon - 3) === LOWER_T &&
			text.charCodeAt(colon - 4) === LOWER_T &&
			text.charCodeAt(colon - 5) === LOWER_H
		);
	}

	return false;
}

// More optimized than using a regex \s
function isWhitespace(code: number): boolean {
	if (code === SPACE || (code >= TAB && code <= CARRIAGE_RETURN)) {
		return true;
	}

	if (code < 0x80) {
		return false;
	}

	return (
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
