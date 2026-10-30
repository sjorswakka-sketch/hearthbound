# Rules references and attribution

Hearthbound includes the complete original English Creative Commons editions of **SRD 5.1** and **SRD 5.2.1**, together with searchable text extracted page by page. These are the complete SRDs, not every D&D rulebook or expansion. Reference availability does not mean that every rule is automatically enforced by the game engine.

## Required SRD 5.1 attribution

This work includes material taken from the System Reference Document 5.1 (“SRD 5.1”) by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.

## Required SRD 5.2.1 attribution

This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.

## Included files and changes

- `public/rules/srd-5.1.pdf`: original 403-page official Creative Commons PDF, unchanged.
- `public/rules/srd-5.2.1.pdf`: original 364-page official Creative Commons PDF, unchanged.
- Matching `.json` files: all pages' text extracted with pypdf, Unicode compatibility normalization, and whitespace cleanup. Page boundaries and complete content are retained. Tables, columns, wrapped words, or display capitalization may differ from the source; the original PDF remains the authority for exact layout and wording.
- `public/rules/manifest.json`: source URLs, PDF SHA-256 integrity hashes, page counts, license links, attribution, and extraction notes.
- `scripts/import-srd.py`: reproducible importer. The generated library is distributed with the app, so users do not need Python or network access to read it.

Rule references, original game code, and original Hearthbound setting content remain distinct. No endorsement is implied. The Creative Commons license is available at <https://creativecommons.org/licenses/by/4.0/legalcode>.

## Official sources

- SRD landing page: <https://www.dndbeyond.com/srd>
- SRD 5.1 Creative Commons PDF: <https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1.pdf>
- SRD 5.2.1 Creative Commons PDF: <https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf>

Sources verified 30 October 2026. The SRD page labels SRD 5.1 as the 2014/5e rules family and SRD 5.2.1 as the revised 2024/5.5e rules family. A campaign's rules version must be pinned independently of later app updates.
