#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_decoupled_egw.py
Automated verification test suite for decoupled EGW commentary corpus,
atomic block anchor integrity, and RVG biblical text integration.
"""

import os
import re
import json
import unittest

class TestDecoupledEGW(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base_dir = os.path.dirname(os.path.abspath(__file__))
        cls.json_path = os.path.join(cls.base_dir, 'data', 'egw_comments_cba7a.json')
        cls.vault_bible_path = os.path.abspath(r'C:\Users\eljua\Documents\UAP\70. Bible')
        cls.vault_rvg_path = os.path.join(cls.vault_bible_path, 'RVG')
        cls.vault_egw_path = os.path.join(cls.vault_bible_path, 'Comentarios', 'EGW')

        with open(cls.json_path, 'r', encoding='utf-8') as f:
            cls.dataset = json.load(f)

    def test_json_structure_and_no_duplicates(self):
        """Verify the JSON dataset is normalized, deduplicated, and free of encoding or comma defects."""
        self.assertGreaterEqual(len(self.dataset), 50, "Expected at least 50 books in CBA 7A dataset")

        # Multi-verse span in Genesis 1 must be keyed as '1-3' and NOT duplicated as separate '1', '2', '3'
        self.assertIn("1-3", self.dataset["Génesis"]["1"])
        self.assertNotIn("1", self.dataset["Génesis"]["1"])
        self.assertNotIn("2", self.dataset["Génesis"]["1"])
        self.assertNotIn("3", self.dataset["Génesis"]["1"])

        total_comments = 0
        all_egw_quotes = []

        for book, chapters in self.dataset.items():
            self.assertIsInstance(chapters, dict)
            for ch, ranges in chapters.items():
                self.assertIsInstance(ranges, dict)
                # Verify 0 duplicate EGW comment text entries within any chapter (excluding editorial cross-reference pointers)
                chapter_texts = [it['text'] for rk in ranges for it in ranges[rk] if not it['text'].startswith('Ver ')]
                self.assertEqual(len(chapter_texts), len(set(chapter_texts)),
                                 f"Duplicate comment text found within {book} {ch}")

                for rk, items in ranges.items():
                    self.assertIsInstance(items, list)
                    self.assertGreater(len(items), 0)
                    for it in items:
                        total_comments += 1
                        self.assertIn('range', it)
                        self.assertIn('anchor', it)
                        self.assertIn('verses', it)
                        self.assertIn('source', it)
                        self.assertIn('text', it)

                        # Verify anchor format: egw-<ch>-<range>
                        expected_anchor = f"egw-{ch}-{rk}"
                        self.assertEqual(it['anchor'], expected_anchor)

                        src = it['source']
                        # Citations must not contain double commas or invalid spacing
                        self.assertNotIn(',,', src)
                        self.assertNotIn('Carta,', src)
                        self.assertNotIn('Manuscrito,', src)

                        text = it['text']
                        self.assertGreater(len(text), 5)
                        if not text.startswith('Ver '):
                            all_egw_quotes.append(text)

        self.assertGreaterEqual(total_comments, 2000, f"Expected >= 2000 comments, got {total_comments}")
        # Global deduplication: 0 duplicate Ellen White quotes across entire corpus
        self.assertEqual(len(all_egw_quotes), len(set(all_egw_quotes)),
                         "Found duplicate EGW quote entries in corpus")

    def test_commentary_corpus_files_and_anchors(self):
        """Verify that all decoupled commentary notes exist with frontmatter, H1, and atomic anchors."""
        self.assertTrue(os.path.exists(self.vault_egw_path), "Directory 70. Bible/Comentarios/EGW does not exist")

        for book_name, chapters in self.dataset.items():
            book_dir = os.path.join(self.vault_egw_path, book_name)
            self.assertTrue(os.path.exists(book_dir), f"Directory for {book_name} missing in {self.vault_egw_path}")

            for ch_str, ranges in chapters.items():
                filename = f"{book_name} {ch_str} (EGW).md"
                file_path = os.path.join(book_dir, filename)
                self.assertTrue(os.path.exists(file_path), f"Commentary note {filename} missing at {file_path}")

                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()

                # Frontmatter checks
                self.assertIn("tipo: comentario", content)
                self.assertIn("autor: Elena G. de White", content)
                self.assertIn("fuente: CBA Tomo 7A", content)
                self.assertIn(f"libro: {book_name}", content)
                self.assertIn(f"capitulo: {ch_str}", content)

                # Heading check
                self.assertIn(f"# {book_name} {ch_str} — Comentarios de Elena G. de White", content)

                # Callout and block anchor check for every range
                for rk, items in ranges.items():
                    anchor = f"^{items[0]['anchor']}"
                    self.assertIn(anchor, content, f"Anchor {anchor} missing in {filename}")
                    self.assertIn("> [!quote]", content, f"Missing callout quote in {filename}")

    def test_rvg_biblical_text_integration_and_clean_layout(self):
        """Verify RVG chapters have inline 🕊️ badges, clean footnotes, and no embedded callouts."""
        # Check Genesis 1 sample
        gen1_path = os.path.join(self.vault_rvg_path, "Génesis", "Génesis 1.md")
        self.assertTrue(os.path.exists(gen1_path))
        with open(gen1_path, 'r', encoding='utf-8') as f:
            gen1 = f.read()

        # Multi-verse span: vv 1, 2, 3 must all link to the shared block ^egw-1-1-3
        self.assertIn("[[Génesis 1 (EGW)#^egw-1-1-3|🕊️]]", gen1)
        self.assertIn("[[Génesis 1 (EGW)#^egw-1-26|🕊️]]", gen1)
        self.assertIn("[[Génesis 1 (EGW)#^egw-1-27|🕊️]]", gen1)
        self.assertIn("[[Génesis 1 (EGW)#^egw-1-29|🕊️]]", gen1)

        # CommonMark footnotes must be purely cross-references
        self.assertNotIn("[Comentario de EGW]", gen1)
        self.assertNotIn("## Comentarios de Elena G. de White", gen1)
        self.assertNotIn("> [!quote]", gen1)

        # Navigation link %20 encoding
        self.assertIn("Génesis%202.md", gen1)

    def test_100_percent_anchor_resolution_across_rvg(self):
        """Verify 100% of inline 🕊️ links in all 1,189 RVG chapters resolve to valid anchors."""
        total_links_verified = 0
        broken_links = []

        # Cache file contents to make test fast
        file_cache = {}

        for root, _, files in os.walk(self.vault_rvg_path):
            for file in files:
                if not file.endswith('.md'):
                    continue
                file_path = os.path.join(root, file)
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()

                # Find all [[<TargetFile>#^<TargetAnchor>|🕊️]]
                matches = re.findall(r'\[\[([^#]+)#\^([a-zA-Z0-9_\-]+)\|🕊️\]\]', content)
                for target_file_name, anchor_id in matches:
                    total_links_verified += 1
                    # Book name is first word(s) before chapter number
                    # e.g., 'Génesis 1 (EGW)' -> book 'Génesis'
                    # e.g., '1 Juan 2 (EGW)' -> book '1 Juan'
                    m_book = re.match(r'^(.*?)\s+\d+\s+\(EGW\)$', target_file_name)
                    self.assertIsNotNone(m_book, f"Invalid commentary file name format: {target_file_name}")
                    book_name = m_book.group(1)

                    target_path = os.path.join(self.vault_egw_path, book_name, f"{target_file_name}.md")
                    if target_path not in file_cache:
                        if not os.path.exists(target_path):
                            broken_links.append(f"Missing file: {target_path} referenced in {file}")
                            continue
                        with open(target_path, 'r', encoding='utf-8') as tf:
                            file_cache[target_path] = tf.read()

                    target_content = file_cache[target_path]
                    anchor_token = f"^{anchor_id}"
                    if anchor_token not in target_content:
                        broken_links.append(f"Missing anchor {anchor_token} in {target_file_name}.md (referenced from {file})")

        self.assertGreaterEqual(total_links_verified, 4000, f"Expected >= 4000 verified links, got {total_links_verified}")
        self.assertEqual(len(broken_links), 0, f"Found {len(broken_links)} broken links:\n" + "\n".join(broken_links[:10]))
        print(f"\nSuccessfully verified {total_links_verified} inline badges across RVG with 100% anchor resolution.")

    def test_navigation_links_retain_url_encoding(self):
        """Verify all navigation links in multi-word books maintain %20 encoding."""
        sample_books = ["1 Juan", "1 Corintios", "2 Reyes", "Cantar de los Cantares"]
        checked = 0
        for b in sample_books:
            b_dir = os.path.join(self.vault_rvg_path, b)
            if not os.path.exists(b_dir):
                continue
            for f in os.listdir(b_dir):
                if f.endswith('.md'):
                    with open(os.path.join(b_dir, f), 'r', encoding='utf-8') as ch_f:
                        c = ch_f.read()
                    nav_links = re.findall(r'\[(?:Anterior|Siguiente)\]\(([^)]+)\)', c)
                    for nl in nav_links:
                        self.assertIn('%20', nl, f"Navigation link not encoded in {f}: {nl}")
                        checked += 1

        self.assertGreater(checked, 10, "Should verify at least 10 navigation links")

if __name__ == '__main__':
    unittest.main()
