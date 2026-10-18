import { App, Notice, SuggestModal, TFolder } from 'obsidian';
import LocalBibleRefPlugin from 'main';

export default class SwitchVersionModal extends SuggestModal<string> {
	private readonly plugin: LocalBibleRefPlugin;

	constructor(app: App, plugin: LocalBibleRefPlugin) {
		super(app);
		this.plugin = plugin;
		this.setPlaceholder('Seleccionar versión bíblica por defecto...');
	}

	getSuggestions(query: string): string[] {
		const biblesPath = this.plugin.settings.biblesPath;
		if (!biblesPath) return [];

		const folder = this.app.vault.getFolderByPath(biblesPath);
		if (!folder) return [];

		const subfolders = folder.children
			.filter((c): c is TFolder => c instanceof TFolder)
			.map((f) => f.name);

		const q = query.toLowerCase().trim();
		if (!q) return subfolders;

		return subfolders.filter((name) => name.toLowerCase().includes(q));
	}

	renderSuggestion(version: string, el: HTMLElement): void {
		el.empty();
		const isCurrent =
			version === this.plugin.settings.defaultVersionShorthand;
		const row = el.createEl('div', {
			cls: 'local-bible-ref-version-item',
		});
		row.createSpan({ text: version, cls: 'local-bible-ref-version-name' });
		if (isCurrent) {
			row.createSpan({
				text: ' (activa / default)',
				cls: 'local-bible-ref-version-active',
			});
		}
	}

	async onChooseSuggestion(
		version: string,
		_: MouseEvent | KeyboardEvent
	): Promise<void> {
		this.plugin.settings.defaultVersionShorthand = version;
		await this.plugin.saveSettings();
		this.plugin.searchEngine?.buildIndex(version);
		new Notice(`Versión por defecto actualizada a: ${version}`);
	}
}
