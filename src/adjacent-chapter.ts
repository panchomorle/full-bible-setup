import { Book } from './i18n/models';
import { getPolyglotBooks } from './passage-reference';

export const BIBLE_BOOK_ORDER: string[] = [
	'gen',
	'exo',
	'lev',
	'num',
	'deu',
	'jos',
	'jdg',
	'rut',
	'1sa',
	'2sa',
	'1ki',
	'2ki',
	'1ch',
	'2ch',
	'ezr',
	'neh',
	'est',
	'job',
	'psa',
	'pro',
	'ecc',
	'sng',
	'isa',
	'jer',
	'lam',
	'ezk',
	'dan',
	'hos',
	'jol',
	'amo',
	'oba',
	'jon',
	'mic',
	'nam',
	'hab',
	'zep',
	'hag',
	'zec',
	'mal',
	'mat',
	'mrk',
	'luk',
	'jhn',
	'act',
	'rom',
	'1co',
	'2co',
	'gal',
	'eph',
	'php',
	'col',
	'1th',
	'2th',
	'1ti',
	'2ti',
	'tit',
	'phm',
	'heb',
	'jas',
	'1pe',
	'2pe',
	'1jn',
	'2jn',
	'3jn',
	'jud',
	'rev',
];

export const BIBLE_BOOK_CHAPTERS: Record<string, number> = {
	gen: 50,
	exo: 40,
	lev: 27,
	num: 36,
	deu: 34,
	jos: 24,
	jdg: 21,
	rut: 4,
	'1sa': 31,
	'2sa': 24,
	'1ki': 22,
	'2ki': 25,
	'1ch': 29,
	'2ch': 36,
	ezr: 10,
	neh: 13,
	est: 10,
	job: 42,
	psa: 150,
	pro: 31,
	ecc: 12,
	sng: 8,
	isa: 66,
	jer: 52,
	lam: 5,
	ezk: 48,
	dan: 12,
	hos: 14,
	jol: 3,
	amo: 9,
	oba: 1,
	jon: 4,
	mic: 7,
	nam: 3,
	hab: 3,
	zep: 3,
	hag: 2,
	zec: 14,
	mal: 4,
	mat: 28,
	mrk: 16,
	luk: 24,
	jhn: 21,
	act: 28,
	rom: 16,
	'1co': 16,
	'2co': 13,
	gal: 6,
	eph: 6,
	php: 4,
	col: 4,
	'1th': 5,
	'2th': 3,
	'1ti': 6,
	'2ti': 4,
	tit: 3,
	phm: 1,
	heb: 13,
	jas: 5,
	'1pe': 5,
	'2pe': 3,
	'1jn': 5,
	'2jn': 1,
	'3jn': 1,
	jud: 1,
	rev: 22,
};

export interface AdjacentChapterTarget {
	book: Book;
	chapter: number;
}

/**
 * Resolves a book by id, name, or alias using the polyglot book registry.
 */
export function resolveBook(bookIdOrName: string): Book | undefined {
	const normalized = bookIdOrName.toLowerCase().trim();
	const books = getPolyglotBooks();

	// Exact ID match first
	const byId = books.find((b) => b.id.toLowerCase() === normalized);
	if (byId) return byId;

	// Name or alias match
	return books.find((b) => {
		if (b.name.toLowerCase() === normalized) return true;
		return b.aliases.some((a) => a.toLowerCase() === normalized);
	});
}

/**
 * Returns the total number of chapters in the given book.
 */
export function getBookChapterCount(bookIdOrName: string): number {
	const book = resolveBook(bookIdOrName);
	if (!book) return 0;
	return BIBLE_BOOK_CHAPTERS[book.id] ?? 0;
}

/**
 * Calculates the adjacent chapter (previous or next), crossing book boundaries when appropriate.
 * Returns null if navigating before Genesis 1 or after Revelation 22.
 */
export function getAdjacentChapter(
	bookIdOrName: string,
	currentChapter: number,
	direction: 'prev' | 'next'
): AdjacentChapterTarget | null {
	const book = resolveBook(bookIdOrName);
	if (!book) return null;

	const bookIndex = BIBLE_BOOK_ORDER.indexOf(book.id);
	if (bookIndex === -1) return null;

	const maxChapters = BIBLE_BOOK_CHAPTERS[book.id] ?? 1;

	if (direction === 'next') {
		if (currentChapter < maxChapters) {
			return {
				book,
				chapter: currentChapter + 1,
			};
		}

		// Boundary: next book, chapter 1
		if (bookIndex < BIBLE_BOOK_ORDER.length - 1) {
			const nextBookId = BIBLE_BOOK_ORDER[bookIndex + 1];
			const nextBook = resolveBook(nextBookId);
			if (nextBook) {
				return {
					book: nextBook,
					chapter: 1,
				};
			}
		}

		// Reached the end of the Bible (Revelation 22)
		return null;
	} else {
		// direction === 'prev'
		if (currentChapter > 1) {
			return {
				book,
				chapter: currentChapter - 1,
			};
		}

		// Boundary: previous book, last chapter
		if (bookIndex > 0) {
			const prevBookId = BIBLE_BOOK_ORDER[bookIndex - 1];
			const prevBook = resolveBook(prevBookId);
			if (prevBook) {
				const prevMaxChapters = BIBLE_BOOK_CHAPTERS[prevBook.id] ?? 1;
				return {
					book: prevBook,
					chapter: prevMaxChapters,
				};
			}
		}

		// Reached the start of the Bible (Genesis 1)
		return null;
	}
}
