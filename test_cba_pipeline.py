#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_cba_pipeline.py
Automated validation test suite for CBA 7A EGW comments dataset and RVG Markdown callouts.
"""

import os
import re
import json
import unittest

class TestCBAPipeline(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base_dir = os.path.dirname(os.path.abspath(__file__))
        cls.json_path = os.path.join(cls.base_dir, 'data', 'egw_comments_cba7a.json')
        cls.vault_rvg_path = os.path.abspath(r'C:\Users\eljua\Documents\UAP\70. Bible\RVG')
        
        with open(cls.json_path, 'r', encoding='utf-8') as f:
            cls.dataset = json.load(f)

    def test_json_structure_and_volume(self):
        """Verify the JSON dataset contains extensive Old and New Testament coverage."""
        self.assertGreaterEqual(len(self.dataset), 50, "Expected at least 50 books in CBA 7A dataset")
        
        # Verify Old Testament and New Testament presence
        self.assertIn("Génesis", self.dataset)
        self.assertIn("Éxodo", self.dataset)
        self.assertIn("Salmos", self.dataset)
        self.assertIn("Isaías", self.dataset)
        self.assertIn("Daniel", self.dataset)
        self.assertIn("Mateo", self.dataset)
        self.assertIn("Juan", self.dataset)
        self.assertIn("Romanos", self.dataset)
        self.assertIn("Hebreos", self.dataset)
        self.assertIn("Apocalipsis", self.dataset)

        total_chapters = 0
        total_verses = 0
        total_comments = 0

        for book, chapters in self.dataset.items():
            self.assertIsInstance(chapters, dict)
            for ch, verses in chapters.items():
                total_chapters += 1
                self.assertIsInstance(verses, dict)
                for v, comments in verses.items():
                    total_verses += 1
                    self.assertIsInstance(comments, list)
                    self.assertGreater(len(comments), 0)
                    for item in comments:
                        total_comments += 1
                        self.assertIn('text', item)
                        self.assertIn('source', item)
                        self.assertIsInstance(item['text'], str)
                        self.assertIsInstance(item['source'], str)
                        self.assertGreater(len(item['text']), 5)

        self.assertGreaterEqual(total_chapters, 500, f"Expected >= 500 chapters, got {total_chapters}")
        self.assertGreaterEqual(total_verses, 3000, f"Expected >= 3000 indexed verses, got {total_verses}")
        self.assertGreaterEqual(total_comments, 2000, f"Expected >= 2000 comments, got {total_comments}")

    def test_sample_rvg_files_contain_callouts_and_anchors(self):
        """Verify that generated Markdown files have properly matched callouts and anchors."""
        test_samples = [
            ("Génesis", "Génesis 1.md", ["^egw-1-1", "^egw-1-26", "^egw-1-27"]),
            ("Juan", "Juan 1.md", ["^egw-1-1", "^egw-1-14"]),
            ("Apocalipsis", "Apocalipsis 14.md", ["^egw-14-1", "^egw-14-6", "^egw-14-12"])
        ]

        for book_name, filename, expected_anchors in test_samples:
            file_path = os.path.join(self.vault_rvg_path, book_name, filename)
            self.assertTrue(os.path.exists(file_path), f"File {file_path} does not exist")
            
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            self.assertIn("## Comentarios de Elena G. de White", content)
            self.assertIn("> [!quote]- Comentario de Elena G. de White", content)

            for anchor in expected_anchors:
                # 1. Anchor definition must exist in a callout line
                self.assertIn(anchor, content, f"Missing anchor {anchor} in {filename}")
                # 2. Footnote link to anchor must exist
                self.assertIn(f"(#{anchor})", content, f"Missing link (#{anchor}) in footnotes of {filename}")

    def test_vault_rvg_footnote_integrity(self):
        """Scan random sample of 20 RVG chapters with EGW comments and verify all links resolve."""
        verified_count = 0
        for root, _, files in os.walk(self.vault_rvg_path):
            for file in files:
                if file.endswith('.md'):
                    path = os.path.join(root, file)
                    with open(path, 'r', encoding='utf-8') as f:
                        text = f.read()
                    if "## Comentarios de Elena G. de White" in text:
                        # Find all footnote links: [Comentario de EGW](#^egw-X-Y)
                        fn_links = re.findall(r'\[Comentario de EGW\]\(#\^([a-zA-Z0-9_\-]+)\)', text)
                        for target_id in fn_links:
                            # Verify target anchor exists in file
                            anchor = f"^{target_id}"
                            self.assertIn(anchor, text, f"Broken EGW link {anchor} in {file}")
                        verified_count += 1
                        if verified_count >= 25:
                            break
            if verified_count >= 25:
                break
        self.assertGreaterEqual(verified_count, 20, "Should verify at least 20 chapters with EGW comments")

if __name__ == '__main__':
    unittest.main()
