export type HighlightColor = 'yellow' | 'green' | 'cyan' | 'pink' | 'orange';

export interface PaletteItem {
	id: HighlightColor;
	label: string;
	className: string;
	color: string;
}

export const HIGHLIGHT_PALETTE: PaletteItem[] = [
	{ id: 'yellow', label: 'Amarillo', className: 'hl-yellow', color: '#ffd54f' },
	{ id: 'green', label: 'Verde', className: 'hl-green', color: '#81c784' },
	{ id: 'cyan', label: 'Celeste', className: 'hl-cyan', color: '#4dd0e1' },
	{ id: 'pink', label: 'Rosa', className: 'hl-pink', color: '#f06292' },
	{ id: 'orange', label: 'Naranja', className: 'hl-orange', color: '#ffb74d' },
];

export interface HighlightToolbarCallbacks {
	onHighlight?: (
		color: HighlightColor,
		selectedText: string,
		range?: Range
	) => void;
	onModifyHighlight?: (markEl: HTMLElement, newColor: HighlightColor) => void;
	onRemoveHighlight?: (markEl: HTMLElement) => void;
	onDismiss?: () => void;
}

export interface RectLike {
	top: number;
	bottom: number;
	left: number;
	right: number;
	width: number;
	height: number;
}

export class HighlightToolbar {
	private readonly containerEl: HTMLElement;
	private readonly callbacks: HighlightToolbarCallbacks;

	private toolbarEl: HTMLElement | null = null;
	private visible = false;
	private currentMode: 'selection' | 'edit' | null = null;
	private targetMarkEl: HTMLElement | null = null;
	private selectedText = '';
	private selectedRange: Range | null = null;

	constructor(
		containerEl: HTMLElement,
		callbacks: HighlightToolbarCallbacks = {}
	) {
		this.containerEl = containerEl;
		this.callbacks = callbacks;
	}

	get el(): HTMLElement | null {
		return this.toolbarEl;
	}

	get isVisible(): boolean {
		return this.visible;
	}

	get mode(): 'selection' | 'edit' | null {
		return this.currentMode;
	}

	/**
	 * Shows the floating toolbar for an active text selection.
	 */
	showForSelection(rect: RectLike, text: string, range?: Range): void {
		this.hide();

		this.visible = true;
		this.currentMode = 'selection';
		this.selectedText = text;
		this.selectedRange = range || null;

		this.buildToolbar(rect);
	}

	/**
	 * Shows the contextual menu for inspecting or editing an existing highlight.
	 */
	showForMark(markEl: HTMLElement): void {
		this.hide();

		this.visible = true;
		this.currentMode = 'edit';
		this.targetMarkEl = markEl;

		const rect =
			typeof markEl.getBoundingClientRect === 'function'
				? markEl.getBoundingClientRect()
				: { top: 100, bottom: 120, left: 50, right: 200, width: 150, height: 20 };

		this.buildToolbar(rect);
	}

	/**
	 * Dismisses and removes the floating toolbar.
	 */
	hide(): void {
		if (this.toolbarEl) {
			if (typeof this.toolbarEl.remove === 'function') {
				this.toolbarEl.remove();
			} else if (this.toolbarEl.parentElement) {
				const p = this.toolbarEl.parentElement as any;
				if (Array.isArray(p.children)) {
					const idx = p.children.indexOf(this.toolbarEl);
					if (idx !== -1) p.children.splice(idx, 1);
				}
			}
			this.toolbarEl = null;
		}

		const wasVisible = this.visible;
		this.visible = false;
		this.currentMode = null;
		this.targetMarkEl = null;
		this.selectedText = '';
		this.selectedRange = null;

		if (wasVisible && this.callbacks.onDismiss) {
			this.callbacks.onDismiss();
		}
	}

	/**
	 * Keydown listener helper for dismissing on Escape.
	 */
	handleKeyDown(e: { key: string; preventDefault?: () => void }): void {
		if (e.key === 'Escape') {
			if (e.preventDefault) e.preventDefault();
			this.hide();
		}
	}

	/**
	 * Builds and positions the floating toolbar DOM element.
	 */
	private buildToolbar(targetRect: RectLike): void {
		let toolbar: HTMLElement;
		if (typeof this.containerEl.createDiv === 'function') {
			toolbar = this.containerEl.createDiv({
				cls: 'local-bible-highlight-toolbar',
			});
		} else {
			toolbar = document.createElement('div');
			toolbar.className = 'local-bible-highlight-toolbar';
			this.containerEl.appendChild(toolbar);
		}

		this.toolbarEl = toolbar;

		// Calculate relative positioning
		const containerRect =
			typeof this.containerEl.getBoundingClientRect === 'function'
				? this.containerEl.getBoundingClientRect()
				: { top: 0, bottom: 600, left: 0, right: 400, width: 400, height: 600 };

		const relTop = targetRect.top - containerRect.top;
		const relLeft = targetRect.left - containerRect.left;
		const relCenter = relLeft + targetRect.width / 2;

		const approxToolbarWidth = this.currentMode === 'edit' ? 220 : 180;
		const approxToolbarHeight = 36;

		let finalTop = relTop - approxToolbarHeight - 8;
		if (finalTop < 8) {
			// Place below if not enough room above
			finalTop = targetRect.bottom - containerRect.top + 8;
		}

		let finalLeft = relCenter - approxToolbarWidth / 2;
		if (finalLeft < 8) finalLeft = 8;
		if (finalLeft + approxToolbarWidth > containerRect.width - 8) {
			finalLeft = Math.max(8, containerRect.width - approxToolbarWidth - 8);
		}

		toolbar.style.position = 'absolute';
		toolbar.style.top = `${Math.round(finalTop)}px`;
		toolbar.style.left = `${Math.round(finalLeft)}px`;
		toolbar.style.zIndex = '50';

		// Render color chips
		const chipsContainer =
			typeof toolbar.createDiv === 'function'
				? toolbar.createDiv({ cls: 'local-bible-chips-row' })
				: (toolbar as any).createEl('div', { cls: 'local-bible-chips-row' });

		for (const item of HIGHLIGHT_PALETTE) {
			const chip =
				typeof chipsContainer.createEl === 'function'
					? chipsContainer.createEl('button', {
							cls: `local-bible-color-chip ${item.className}`,
					  })
					: chipsContainer.createDiv({
							cls: `local-bible-color-chip ${item.className}`,
					  });

			chip.setAttribute('data-color', item.id);
			chip.title = item.label;
			chip.style.backgroundColor = item.color;

			chip.onclick = (e?: MouseEvent) => {
				if (e && e.stopPropagation) e.stopPropagation();

				if (this.currentMode === 'selection') {
					if (this.callbacks.onHighlight) {
						this.callbacks.onHighlight(
							item.id,
							this.selectedText,
							this.selectedRange || undefined
						);
					}
				} else if (this.currentMode === 'edit' && this.targetMarkEl) {
					if (this.callbacks.onModifyHighlight) {
						this.callbacks.onModifyHighlight(this.targetMarkEl, item.id);
					}
				}

				this.hide();
			};
		}

		// Edit Mode: Show Unmark action
		if (this.currentMode === 'edit') {
			const unmarkBtn =
				typeof toolbar.createEl === 'function'
					? toolbar.createEl('button', {
							cls: 'local-bible-unmark-btn',
							text: 'Eliminar',
					  })
					: toolbar.createDiv({
							cls: 'local-bible-unmark-btn',
							text: 'Eliminar',
					  });

			unmarkBtn.title = 'Eliminar resaltado';
			unmarkBtn.onclick = (e?: MouseEvent) => {
				if (e && e.stopPropagation) e.stopPropagation();
				if (this.targetMarkEl && this.callbacks.onRemoveHighlight) {
					this.callbacks.onRemoveHighlight(this.targetMarkEl);
				}
				this.hide();
			};
		}

		// Dismiss button
		const dismissBtn =
			typeof toolbar.createEl === 'function'
				? toolbar.createEl('button', {
						cls: 'local-bible-dismiss-btn',
						text: '✕',
				  })
				: toolbar.createDiv({
						cls: 'local-bible-dismiss-btn',
						text: '✕',
				  });

		dismissBtn.title = 'Cerrar';
		dismissBtn.onclick = (e?: MouseEvent) => {
			if (e && e.stopPropagation) e.stopPropagation();
			this.hide();
		};
	}
}

export default HighlightToolbar;

