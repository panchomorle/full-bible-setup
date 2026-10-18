#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_smart_pointers.py
Unit and integration tests for EGW smart pointers and chained hover preview (Issue 10).
"""

import os
import re
import json
import unittest

from smart_pointers import (
    BOOK_MAP,
    POINTER_PREFIX_REGEX,
    build_anchor_registry,
    resolve_anchor,
    transform_comment_text,
    transform_pointer_body,
    normalize_book
)

class TestSmartPointers(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base_dir = os.path.dirname(os.path.abspath(__file__))
        cls.json_path = os.path.join(cls.base_dir, 'data', 'egw_comments_cba7a.json')
        cls.vault_egw_path = os.path.abspath(r'C:\Users\eljua\Documents\UAP\70. Bible\Comentarios\EGW')

        with open(cls.json_path, 'r', encoding='utf-8') as f:
            cls.dataset = json.load(f)
        cls.registry = build_anchor_registry(cls.dataset)

    def test_pointer_prefix_detection(self):
        """Verify that all cross-reference prefix variations are detected."""
        prefixes = [
            "Ver el comentario de EGW sobre Deut. 1: 1.",
            "Ver com. de EGW cap. 5: 13, 14.",
            "Ver Com. de EGW 1 Crón. 21: 1-13.",
            "Ver EGW com. Juan 1: 1-3, 14; Col. 2: 9.",
            "Ver EGW, com. cap. 4:7; Rom. 7:12.",
            "Ver EGW comentario de 2 Tes. 2: 7-12.",
            "Ver EGW com. vers. 30; 2 Cor. 3: 18.",
            "Ver EGW com. com. Heb. 2: 14."
        ]
        for p in prefixes:
            m = POINTER_PREFIX_REGEX.match(p)
            self.assertIsNotNone(m, f"Prefix not matched for: {p}")

    def test_structured_target_parsing_and_resolution(self):
        """Verify parsing of same-chapter, same-book, multi-verse, and cross-book pointers."""
        # 1. Same-chapter verse pointer
        res = transform_comment_text('Efesios', 4, "Ver EGW com. vers. 30.", self.registry)
        self.assertIn("[[Efesios 4 (EGW)#^egw-4-30|vers. 30]]", res)

        # 2. Same-book different chapter pointer
        res = transform_comment_text('Josué', 6, "Ver com. de EGW cap. 5: 13, 14.", self.registry)
        self.assertIn("[[Josué 5 (EGW)#^egw-5-13-14|cap. 5:13]]", res)

        # 3. Multi-verse list across books
        res = transform_comment_text('Juan', 1, "Ver EGW com. cap.: 1-3; Juan 1: 1-3,14; Col.2: 9.", self.registry)
        self.assertIn("[[Juan 1 (EGW)#^egw-1-1-3|cap.: 1-3]]", res)
        self.assertIn("[[Juan 1 (EGW)#^egw-1-1-3|Juan 1:1-3]]", res)
        self.assertIn("[[Juan 1 (EGW)#^egw-1-14|14]]", res)
        self.assertIn("[[Colosenses 2 (EGW)#^egw-2-9|Col. 2:9]]", res)

    def test_enclosing_range_anchor_resolution(self):
        """Verify that a sub-verse or verse inside a multi-verse range resolves to the enclosing anchor."""
        # Verse 14 inside 13-14 in Josue 5
        anchor = resolve_anchor(self.registry, 'Josué', 5, 14, 14)
        self.assertEqual(anchor, 'egw-5-13-14')

        # Verse 2 inside 1-3 in Genesis 1
        anchor_gen = resolve_anchor(self.registry, 'Génesis', 1, 2, 2)
        self.assertEqual(anchor_gen, 'egw-1-1-3')

    def test_volume_suffix_preservation(self):
        """Verify that trailing volume and page citations are preserved."""
        res = transform_comment_text('Josué', 24, "Ver com. de EGW Deut. 30: 15-19, t. I, pág. 1134.", self.registry)
        self.assertIn("[[Deuteronomio 30 (EGW)#^egw-30-15-19|Deut. 30:15-19]]", res)
        self.assertIn(", t. I, pág. 1134", res)

    def test_zero_broken_wikilinks_across_entire_vault_corpus(self):
        """Verify 100% of wikilinks in all generated commentary files resolve to valid notes and anchors."""
        self.assertTrue(os.path.exists(self.vault_egw_path))

        file_cache = {}
        for root, dirs, files in os.walk(self.vault_egw_path):
            for f in files:
                if f.endswith('.md'):
                    with open(os.path.join(root, f), 'r', encoding='utf-8') as fh:
                        file_cache[f] = fh.read()

        total_wikilinks = 0
        broken_files = []
        broken_anchors = []

        wikilink_pattern = re.compile(r'\[\[([^#\|\]]+)(?:#\^([^\|\]]+))?\|([^\]]+)\]\]')

        for filename, content in file_cache.items():
            for m in wikilink_pattern.finditer(content):
                total_wikilinks += 1
                target_note = m.group(1).strip()
                target_anchor = m.group(2)
                target_file = f"{target_note}.md"

                if target_file not in file_cache:
                    broken_files.append((filename, target_file))
                elif target_anchor:
                    target_content = file_cache[target_file]
                    if f"^{target_anchor}" not in target_content:
                        broken_anchors.append((filename, target_file, target_anchor))

        self.assertGreaterEqual(total_wikilinks, 600, f"Expected >= 600 smart wikilinks, found {total_wikilinks}")
        self.assertEqual(len(broken_files), 0, f"Found broken file links: {broken_files}")
        self.assertEqual(len(broken_anchors), 0, f"Found broken anchor links: {broken_anchors}")

if __name__ == '__main__':
    unittest.main()
