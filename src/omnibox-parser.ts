import { Book } from './i18n/models';
import { getPolyglotBooks } from './passage-reference';

export interface OmniboxPassageTarget {
	type: 'passage';
	bookId: string;
	bookName: string;
	chapter: number;
	verse: number;
	endChapter?: number;
	endVerse?: number;
	label: string;
	subtitle: string;
}

export function normalizeOmniboxText(str: string): string {
	return str
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.trim();
}

export default class OmniboxParser {
	/**
	 * Parses a user search query into potential structural passage targets (Book/Chapter/Verse).
	 * Returns an empty array if the query is purely textual or cannot be matched to any book.
	 */
	static parsePassageTargets(query: string): OmniboxPassageTarget[] {
		let clean = query.trim().replace(/^--\s*/, '');
		clean = clean.replace(/\s+/g, ' ');
		if (clean.length < 2) return [];

		const books = getPolyglotBooks();

		// Case 1: Pattern with explicit space between book and chapter/verse
		// e.g. "juan 3:16", "juan 3", "1 juan 3:16", "1 co 13:4-8", "gn 1"
		const refWithSpaceRegex = /^(.+?)\s+(\d{1,3})(?::(\d{1,3}))?(?:-(\d{1,3}))?$/;
		let match = clean.match(refWithSpaceRegex);

		if (match) {
			const candidateBook = match[1];
			const chapter = parseInt(match[2]);
			const verse = match[3] ? parseInt(match[3]) : 1;
			const endVerse = match[4] ? parseInt(match[4]) : undefined;
			const isChapterOnly = !match[3];

			const book = this.findBook(candidateBook, books);
			if (book) {
				return [
					{
						type: 'passage',
						bookId: book.id,
						bookName: book.name,
						chapter,
						verse,
						endChapter: chapter,
						endVerse,
						label: isChapterOnly
							? `${book.name} ${chapter}:1`
							: `${book.name} ${chapter}:${verse}${endVerse ? '-' + endVerse : ''}`,
						subtitle: isChapterOnly
							? `Capítulo ${chapter}`
							: `Versículo ${verse}${endVerse ? '-' + endVerse : ''}`,
					},
				];
			}
		}

		// Case 2: Attached chapter without space (e.g. "jn3:16", "juan3", "gn1", "1co13")
		const attachedRegex = /^([1-3]?[a-zA-ZáéíóúÁÉÍÓÚñÑ]+)\s*(\d{1,3})(?::(\d{1,3}))?(?:-(\d{1,3}))?$/;
		match = clean.match(attachedRegex);
		if (match) {
			const candidateBook = match[1];
			const chapter = parseInt(match[2]);
			const verse = match[3] ? parseInt(match[3]) : 1;
			const endVerse = match[4] ? parseInt(match[4]) : undefined;
			const isChapterOnly = !match[3];

			const book = this.findBook(candidateBook, books);
			if (book) {
				return [
					{
						type: 'passage',
						bookId: book.id,
						bookName: book.name,
						chapter,
						verse,
						endChapter: chapter,
						endVerse,
						label: isChapterOnly
							? `${book.name} ${chapter}:1`
							: `${book.name} ${chapter}:${verse}${endVerse ? '-' + endVerse : ''}`,
						subtitle: isChapterOnly
							? `Capítulo ${chapter}`
							: `Versículo ${verse}${endVerse ? '-' + endVerse : ''}`,
					},
				];
			}
		}

		// Case 3: Book-only query (e.g. "juan", "genesis", "gn", "1 juan", "1 co")
		// Check for exact match first
		const exactBook = this.findBook(clean, books);
		if (exactBook) {
			return [
				{
					type: 'passage',
					bookId: exactBook.id,
					bookName: exactBook.name,
					chapter: 1,
					verse: 1,
					endChapter: 1,
					endVerse: 1,
					label: `${exactBook.name} 1:1`,
					subtitle: `Libro de ${exactBook.name}`,
				},
			];
		}

		// If no exact match and query is >= 2 chars, look for prefix matches
		const normQuery = normalizeOmniboxText(clean);
		if (normQuery.length >= 2) {
			const prefixMatches: Book[] = [];
			const seenBookIds = new Set<string>();

			for (const b of books) {
				if (seenBookIds.has(b.id)) continue;
				const normName = normalizeOmniboxText(b.name);
				if (normName.startsWith(normQuery)) {
					prefixMatches.push(b);
					seenBookIds.add(b.id);
					continue;
				}

				for (const a of b.aliases) {
					const normAlias = normalizeOmniboxText(a);
					if (normAlias.startsWith(normQuery) && !seenBookIds.has(b.id)) {
						prefixMatches.push(b);
						seenBookIds.add(b.id);
						break;
					}
				}
			}

			if (prefixMatches.length > 0) {
				return prefixMatches.slice(0, 5).map((b) => ({
					type: 'passage',
					bookId: b.id,
					bookName: b.name,
					chapter: 1,
					verse: 1,
					endChapter: 1,
					endVerse: 1,
					label: `${b.name} 1:1`,
					subtitle: `Libro de ${b.name}`,
				}));
			}
		}

		return [];
	}

	private static findBook(candidate: string, books: Book[]): Book | null {
		const normCandidate = normalizeOmniboxText(candidate);
		for (const b of books) {
			if (normalizeOmniboxText(b.name) === normCandidate) return b;
			for (const a of b.aliases) {
				if (normalizeOmniboxText(a) === normCandidate) return b;
			}
		}
		return null;
	}
}
