import type { TFile, Vault } from 'obsidian';
import { HighlightColor } from './highlight-toolbar';

export type { HighlightColor };

export interface HighlightOptions {
	verse?: number;
	prefix?: string;
	suffix?: string;
	occurrenceIndex?: number;
}

export interface HighlightAction {
	type: 'create' | 'modify' | 'remove';
	text: string;
	color?: HighlightColor;
	oldColor?: HighlightColor;
	options?: HighlightOptions;
}

export class HighlightMutator {
	/**
	 * Injects a <mark class="hl-[color]"> tag around the specified text in Markdown,
	 * while preserving structural elements like <sup> verse numbers, [^ref_x] footnotes,
	 * [[...]] links, and callout syntax.
	 */
	static injectHighlight(
		markdown: string,
		targetText: string,
		color: HighlightColor,
		options?: HighlightOptions
	): string {
		const trimmedTarget = targetText.trim();
		if (!trimmedTarget) return markdown;

		// 1. Locate verse scope if verse option is provided
		if (options?.verse !== undefined) {
			const verseRange = this.findVerseRange(markdown, options.verse);
			if (verseRange) {
				const verseText = markdown.slice(verseRange.start, verseRange.end);
				const mutatedVerse = this.injectHighlightIntoText(
					verseText,
					trimmedTarget,
					color,
					options
				);
				if (mutatedVerse !== verseText) {
					return (
						markdown.slice(0, verseRange.start) +
						mutatedVerse +
						markdown.slice(verseRange.end)
					);
				}
			}
		}

		// 2. Global fallback injection
		return this.injectHighlightIntoText(
			markdown,
			trimmedTarget,
			color,
			options
		);
	}

	/**
	 * Modifies the highlight color of an existing highlighted span in Markdown.
	 */
	static modifyHighlight(
		markdown: string,
		targetText: string,
		newColor: HighlightColor,
		options?: HighlightOptions
	): string {
		const trimmedTarget = targetText.trim();
		if (!trimmedTarget) return markdown;

		if (options?.verse !== undefined) {
			const verseRange = this.findVerseRange(markdown, options.verse);
			if (verseRange) {
				const verseText = markdown.slice(verseRange.start, verseRange.end);
				const mutatedVerse = this.modifyHighlightInText(
					verseText,
					trimmedTarget,
					newColor,
					options
				);
				if (mutatedVerse !== verseText) {
					return (
						markdown.slice(0, verseRange.start) +
						mutatedVerse +
						markdown.slice(verseRange.end)
					);
				}
			}
		}

		return this.modifyHighlightInText(
			markdown,
			trimmedTarget,
			newColor,
			options
		);
	}

	/**
	 * Removes an existing highlight (unmark), restoring clean raw Markdown.
	 */
	static removeHighlight(
		markdown: string,
		targetText: string,
		options?: HighlightOptions
	): string {
		const trimmedTarget = targetText.trim();
		if (!trimmedTarget) return markdown;

		if (options?.verse !== undefined) {
			const verseRange = this.findVerseRange(markdown, options.verse);
			if (verseRange) {
				const verseText = markdown.slice(verseRange.start, verseRange.end);
				const mutatedVerse = this.removeHighlightInText(
					verseText,
					trimmedTarget,
					options
				);
				if (mutatedVerse !== verseText) {
					return (
						markdown.slice(0, verseRange.start) +
						mutatedVerse +
						markdown.slice(verseRange.end)
					);
				}
			}
		}

		return this.removeHighlightInText(markdown, trimmedTarget, options);
	}

	/**
	 * Persists a highlight change directly to disk via Obsidian Vault API.
	 */
	static async persistHighlight(
		vault: {
			read: (file: any) => Promise<string>;
			modify: (file: any, content: string) => Promise<void>;
		},
		file: any,
		action: HighlightAction
	): Promise<string> {
		const rawContent = await vault.read(file);
		let updated = rawContent;

		if (action.type === 'create') {
			if (!action.color) {
				throw new Error('HighlightColor is required for create action');
			}
			updated = this.injectHighlight(
				rawContent,
				action.text,
				action.color,
				action.options
			);
		} else if (action.type === 'modify') {
			if (!action.color) {
				throw new Error('HighlightColor is required for modify action');
			}
			updated = this.modifyHighlight(
				rawContent,
				action.text,
				action.color,
				action.options
			);
		} else if (action.type === 'remove') {
			updated = this.removeHighlight(
				rawContent,
				action.text,
				action.options
			);
		}

		if (updated !== rawContent) {
			await vault.modify(file, updated);
		}

		return updated;
	}

	/**
	 * Strips all <mark> tags from a string.
	 */
	static stripMarks(content: string): string {
		return content.replace(/<\/?mark\b[^>]*>/gi, '');
	}

	/**
	 * Wraps text in <mark class="hl-[color]"> while protecting structural elements
	 * like <sup>, [^ref_x], and [[...]].
	 */
	static wrapProtected(textToWrap: string, color: HighlightColor): string {
		const leadingWs = textToWrap.match(/^\s*/)?.[0] || '';
		const trailingWs = textToWrap.match(/\s*$/)?.[0] || '';
		const core = textToWrap.slice(
			leadingWs.length,
			textToWrap.length - trailingWs.length
		);

		if (!core) return textToWrap;

		// Regex matching structural elements that must never be wrapped inside <mark>
		const structuralRegex =
			/(<sup>\d+<\/sup>|\[\^[^\]]+\]|\[\[[^\]]+\]\]|^>[ \t]*\[![^\]]+\]|^>[ \t]*)/gm;

		// Split by structural elements with capturing groups
		const parts = core.split(structuralRegex);
		const wrappedParts: string[] = [];

		for (const part of parts) {
			if (!part) continue;

			// If part is a structural element, preserve it untouched
			if (
				part.match(
					/^(?:<sup>\d+<\/sup>|\[\^[^\]]+\]|\[\[[^\]]+\]\]|^>[ \t]*\[![^\]]+\]|^>[ \t]*)$/
				)
			) {
				wrappedParts.push(part);
				continue;
			}

			// If part is pure whitespace, preserve as whitespace
			if (/^\s+$/.test(part)) {
				wrappedParts.push(part);
				continue;
			}

			// Plain text chunk: strip any internal mark tags to prevent nesting
			const cleanPart = this.stripMarks(part);
			const partLeading = cleanPart.match(/^\s*/)?.[0] || '';
			const partTrailing = cleanPart.match(/\s*$/)?.[0] || '';
			const partCore = cleanPart.slice(
				partLeading.length,
				cleanPart.length - partTrailing.length
			);

			if (partCore) {
				wrappedParts.push(
					`${partLeading}<mark class="hl-${color}">${partCore}</mark>${partTrailing}`
				);
			} else {
				wrappedParts.push(cleanPart);
			}
		}

		return `${leadingWs}${wrappedParts.join('')}${trailingWs}`;
	}

	/**
	 * Locates the start and end offsets of a specific verse in a chapter file.
	 */
	static findVerseRange(
		markdown: string,
		verse: number
	): { start: number; end: number } | null {
		const versePattern = new RegExp(
			`(^|\\s|\\*\\*\\d+\\*\\*\\s*)<sup>${verse}</sup>`,
			'i'
		);
		const match = markdown.match(versePattern);
		if (!match || match.index === undefined) return null;

		const start = match.index;
		const rest = markdown.slice(start + match[0].length);

		// Delimiters for next verse or end of content
		const nextDelimiter =
			/(?:(?:\*\*\d+\*\*\s*)?<sup>\d+<\/sup>|^---|^(?:\[\^))/m;
		const nextMatch = rest.match(nextDelimiter);

		const end =
			nextMatch && nextMatch.index !== undefined
				? start + match[0].length + nextMatch.index
				: markdown.length;

		return { start, end };
	}

	private static injectHighlightIntoText(
		text: string,
		targetText: string,
		color: HighlightColor,
		options?: HighlightOptions
	): string {
		const match = this.findTargetMatch(text, targetText, options);
		if (!match) return text;

		const rawMatched = match[0];
		// Strip any existing marks inside the matched region to prevent nesting/orphans
		const cleanMatched = this.stripMarks(rawMatched);
		const wrapped = this.wrapProtected(cleanMatched, color);

		return (
			text.slice(0, match.index) +
			wrapped +
			text.slice(match.index + rawMatched.length)
		);
	}

	private static modifyHighlightInText(
		text: string,
		targetText: string,
		newColor: HighlightColor,
		options?: HighlightOptions
	): string {
		const match = this.findExistingHighlightMatch(text, targetText, options);
		if (!match) return text;

		const rawMatched = match[0];
		// Replace all highlight class names in the matched region
		const updated = rawMatched.replace(
			/class="hl-[a-z]+"/gi,
			`class="hl-${newColor}"`
		);

		return (
			text.slice(0, match.index) +
			updated +
			text.slice(match.index + rawMatched.length)
		);
	}

	private static removeHighlightInText(
		text: string,
		targetText: string,
		options?: HighlightOptions
	): string {
		const match = this.findExistingHighlightMatch(text, targetText, options);
		if (!match) return text;

		const rawMatched = match[0];
		// Unmark by stripping <mark> and </mark> tags
		const unwrapped = this.stripMarks(rawMatched);

		return (
			text.slice(0, match.index) +
			unwrapped +
			text.slice(match.index + rawMatched.length)
		);
	}

	private static findTargetMatch(
		haystack: string,
		needle: string,
		options?: HighlightOptions
	): RegExpExecArray | null {
		const escapedNeedle = this.escapeRegex(needle);

		// 1. Check if the exact needle is already wrapped in a <mark> tag
		const wrappedRegex = new RegExp(
			`<mark\\s+class="hl-[a-z]+"[^>]*>\\s*${escapedNeedle}\\s*<\\/mark>`,
			'gi'
		);
		let match = this.selectBestMatch(haystack, wrappedRegex, options);
		if (match) return match;

		// 2. Direct exact match (only when NOT already inside an existing <mark>)
		const exactRegex = new RegExp(escapedNeedle, 'g');
		match = this.selectBestMatch(haystack, exactRegex, options);
		if (match) {
			const prefix = haystack.slice(0, match.index);
			const openMarks = (prefix.match(/<mark\b[^>]*>/gi) || []).length;
			const closeMarks = (prefix.match(/<\/mark>/gi) || []).length;
			if (openMarks <= closeMarks) {
				return match;
			}
		}

		// 3. Fuzzy match allowing optional existing <mark> tags inside or overlapping
		const fuzzyRegex = this.buildFuzzyMarkRegex(needle);
		return this.selectBestMatch(haystack, fuzzyRegex, options);
	}

	private static findExistingHighlightMatch(
		haystack: string,
		needle: string,
		options?: HighlightOptions
	): RegExpExecArray | null {
		// First try: <mark class="hl-..."> surrounding needle
		const escaped = this.escapeRegex(needle);
		const directMarkRegex = new RegExp(
			`<mark\\s+class="hl-[a-z]+"[^>]*>[^<]*${escaped}[^<]*<\\/mark>`,
			'gi'
		);
		let match = this.selectBestMatch(haystack, directMarkRegex, options);
		if (match) return match;

		// Second try: fuzzy mark regex where needle may be split across marks/elements
		const fuzzy = this.buildFuzzyMarkRegex(needle);
		return this.selectBestMatch(haystack, fuzzy, options);
	}

	private static buildFuzzyMarkRegex(needle: string): RegExp {
		const chars = needle.split('').map((c) => {
			if (/\s/.test(c)) {
				return '[\\s\\r\\n]+(?:<mark\\b[^>]*>|<\\/mark>)*';
			}
			return this.escapeRegex(c);
		});
		const pattern =
			'(?:<mark\\b[^>]*>|<\\/mark>)*' +
			chars.join('(?:<mark\\b[^>]*>|<\\/mark>)*') +
			'(?:<mark\\b[^>]*>|<\\/mark>)*';
		return new RegExp(pattern, 'gi');
	}

	private static selectBestMatch(
		haystack: string,
		regex: RegExp,
		options?: HighlightOptions
	): RegExpExecArray | null {
		const matches: RegExpExecArray[] = [];
		let m: RegExpExecArray | null;

		const globalRegex = new RegExp(
			regex.source,
			regex.flags.includes('g') ? regex.flags : regex.flags + 'g'
		);

		while ((m = globalRegex.exec(haystack)) !== null) {
			matches.push(m);
		}

		if (matches.length === 0) return null;
		if (matches.length === 1) return matches[0];

		if (
			options?.occurrenceIndex !== undefined &&
			options.occurrenceIndex < matches.length
		) {
			return matches[options.occurrenceIndex];
		}

		if (options?.prefix || options?.suffix) {
			let bestScore = -1;
			let bestMatch = matches[0];

			for (const currentMatch of matches) {
				let score = 0;
				const matchStart = currentMatch.index;
				const matchEnd = matchStart + currentMatch[0].length;

				if (options.prefix) {
					const actualPrefix = haystack.slice(
						Math.max(0, matchStart - options.prefix.length),
						matchStart
					);
					for (
						let i = 1;
						i <= Math.min(options.prefix.length, actualPrefix.length);
						i++
					) {
						if (
							options.prefix[options.prefix.length - i] ===
							actualPrefix[actualPrefix.length - i]
						) {
							score += 2;
						} else {
							break;
						}
					}
				}

				if (options.suffix) {
					const actualSuffix = haystack.slice(
						matchEnd,
						matchEnd + options.suffix.length
					);
					for (
						let i = 0;
						i < Math.min(options.suffix.length, actualSuffix.length);
						i++
					) {
						if (options.suffix[i] === actualSuffix[i]) {
							score += 2;
						} else {
							break;
						}
					}
				}

				if (score > bestScore) {
					bestScore = score;
					bestMatch = currentMatch;
				}
			}

			return bestMatch;
		}

		return matches[0];
	}

	private static escapeRegex(str: string): string {
		return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}
}

export default HighlightMutator;
