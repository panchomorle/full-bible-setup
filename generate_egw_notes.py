#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_egw_notes.py
Generates decoupled Ellen G. White commentary notes under 70. Bible/Comentarios/EGW/<Libro>/
following the Single Source of Truth (SSOT) architecture and Obsidian atomic block anchor standards.
"""

import os
import json
from smart_pointers import build_anchor_registry, transform_comment_text

VAULT_DEFAULT_PATH = os.path.abspath(r'C:\Users\eljua\Documents\UAP\70. Bible\Comentarios\EGW')

def sort_range_key(key):
    """Sort helper to order verse ranges numerically, e.g. '1-3' before '26'."""
    parts = key.split('-')
    try:
        return int(parts[0]), int(parts[-1])
    except ValueError:
        return 999, 999

def generate_egw_notes(dataset, target_vault_path=VAULT_DEFAULT_PATH):
    os.makedirs(target_vault_path, exist_ok=True)
    registry = build_anchor_registry(dataset)
    total_files = 0
    total_blocks = 0

    for book_name, chapters in dataset.items():
        book_dir = os.path.join(target_vault_path, book_name)
        os.makedirs(book_dir, exist_ok=True)

        for ch_str, ranges in sorted(chapters.items(), key=lambda x: int(x[0])):
            ch = int(ch_str)
            filename = f"{book_name} {ch} (EGW).md"
            file_path = os.path.join(book_dir, filename)

            content = [
                "---",
                "tipo: comentario",
                "autor: Elena G. de White",
                "fuente: CBA Tomo 7A",
                'badge: "🕊️"',
                f"libro: {book_name}",
                f"capitulo: {ch}",
                "---",
                "",
                f"# {book_name} {ch} — Comentarios de Elena G. de White",
                ""
            ]

            sorted_ranges = sorted(ranges.items(), key=lambda item: sort_range_key(item[0]))
            for rk_idx, (range_key, items) in enumerate(sorted_ranges):
                if not items:
                    continue

                total_blocks += 1
                anchor = items[0].get('anchor') or f"egw-{ch}-{range_key}"
                first_title = items[0].get('title')

                if first_title:
                    heading = f"### {ch}:{range_key} — {first_title}"
                else:
                    heading = f"### {ch}:{range_key}"

                content.append(heading)
                content.append("> [!quote]")

                for idx, it in enumerate(items):
                    if idx > 0:
                        content.append(">")
                        content.append("> ***")
                        content.append(">")
                        if it.get('title'):
                            content.append(f"> **{it['title']}**")
                            content.append(">")

                    raw_text = it.get('text', '').strip()
                    text_body = transform_comment_text(book_name, ch, raw_text, registry)
                    # Add callout prefix to lines
                    for text_line in text_body.split('\n'):
                        content.append(f"> {text_line}")

                    source = it.get('source', '').strip()
                    if source:
                        clean_src = source.rstrip('. ')
                        content.append(f"> — *{clean_src}*.")

                content.append(f"^{anchor}")
                content.append("")
                content.append("---")
                content.append("")

            with open(file_path, 'w', encoding='utf-8') as f:
                f.write("\n".join(content).strip() + "\n")

            total_files += 1

    print(f"Generated {total_files} commentary notes with {total_blocks} atomic anchor blocks in {target_vault_path}")
    return total_files, total_blocks

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    json_path = os.path.join(base_dir, 'data', 'egw_comments_cba7a.json')

    print(f"Loading EGW comments from {json_path}...")
    with open(json_path, 'r', encoding='utf-8') as f:
        dataset = json.load(f)

    generate_egw_notes(dataset)

if __name__ == '__main__':
    main()
