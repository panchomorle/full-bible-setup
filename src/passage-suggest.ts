import {
	App,
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
	getLanguage,
	Notice,
	TFile,
} from 'obsidian';
import PassageReference from './passage-reference';
import LocalBibleRefSettings from './settings';
import { I18N } from './i18n';
import PassageResolver, { ResolvedPassage } from './passage-resolver';

export default class PassageSuggest extends EditorSuggest<PassageSuggestion> {
	private readonly settings: LocalBibleRefSettings;
	private readonly resolver: PassageResolver;
	private readonly settingsNotConfiguredText: string;

	private noSettingsNotice: Notice;

	constructor(app: App, settings: LocalBibleRefSettings) {
		super(app);
		this.settings = settings;
		this.resolver = new PassageResolver(app, settings);

		switch (getLanguage()) {
			case 'cs':
				this.settingsNotConfiguredText = I18N.CS.COMMON.settingsNotConfigured;
				break;
			case 'de':
				this.settingsNotConfiguredText = I18N.DE.COMMON.settingsNotConfigured;
				break;
			case 'es':
				this.settingsNotConfiguredText = I18N.ES.COMMON.settingsNotConfigured;
				break;
			case 'ko':
				this.settingsNotConfiguredText = I18N.KO.COMMON.settingsNotConfigured;
				break;
			case 'en':
			default:
				this.settingsNotConfiguredText = I18N.EN.COMMON.settingsNotConfigured;
				break;
		}
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		_: TFile | null
	): EditorSuggestTriggerInfo | null {
		// line must start with '--'
		const line = editor.getLine(cursor.line);
		if (!line.startsWith('--')) return null;

		// if no settings, alert user
		if (!this.settings.biblesPath) {
			if (!this.noSettingsNotice?.messageEl.isShown()) {
				const noticeText = this.settingsNotConfiguredText;
				this.noSettingsNotice = new Notice(noticeText);
			}

			return null;
		}

		// min ref length is 5 ('--ex1')
		if (cursor.ch < 5) return null;

		// must be a passage ref
		const isPassage = PassageReference.regExp.test(line);
		if (!isPassage) return null;

		// trigger info
		return {
			end: cursor,
			query: line,
			start: {
				ch: 0,
				line: cursor.line,
			},
		};
	}

	async getSuggestions(
		context: EditorSuggestContext
	): Promise<PassageSuggestion[]> {
		const res: ResolvedPassage | null = await this.resolver.resolvePassage(
			context.query,
			context.file?.path
		);
		if (!res) return [];

		return [{ excerpt: res.excerpt, text: res.text }];
	}

	renderSuggestion(item: PassageSuggestion, el: HTMLElement): void {
		el.setText(item.excerpt);
	}

	selectSuggestion(
		item: PassageSuggestion,
		_: MouseEvent | KeyboardEvent
	): void {
		if (!this.context) return;
		this.context.editor.replaceRange(
			item.text,
			this.context.start,
			this.context.end
		);
	}
}

export interface PassageSuggestion {
	excerpt: string;
	text: string;
}
