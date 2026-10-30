/** Full, offline official rule references. Reference availability is not automation. */
export type RuleBookId = "srd-5.1" | "srd-5.2.1";
export type RuleBookPage = { page: number; text: string };
export type RuleBookMetadata = {
  id: RuleBookId; title: string; edition: string; source: string; sourcePage: string;
  pdf: string; json: string; license: string; licenseUrl: string; attribution: string;
  pageCount: number; sha256: string; pdfBytes: number; textCharacters: number;
  coverage: string; extractionNotes: string;
};
export type RuleBook = RuleBookMetadata & {
  contents: { title: string; page: number; depth: number }[];
  pages: RuleBookPage[];
};

export const RULES_LIBRARY = [
  {
    id: "srd-5.1", title: "SRD 5.1", edition: "D&D 2014 / 5e", pageCount: 403,
    json: "/rules/srd-5.1.json", pdf: "/rules/srd-5.1.pdf",
    source: "https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1.pdf",
  },
  {
    id: "srd-5.2.1", title: "SRD 5.2.1", edition: "D&D 2024 / 5.5e", pageCount: 364,
    json: "/rules/srd-5.2.1.json", pdf: "/rules/srd-5.2.1.pdf",
    source: "https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf",
  },
] as const;

export function ruleBookMetadata(id: string) {
  return RULES_LIBRARY.find(book => book.id === id);
}

export function normalizedRuleText(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/([a-z])\s*[-\u00ad]\s*\n\s*([a-z])/g, "$1$2").replace(/\s+/g, " ");
}

/** Returns complete matching pages. The viewer can show snippets and link to each PDF page. */
export function searchRuleBook(book: RuleBook, query: string): RuleBookPage[] {
  const terms = normalizedRuleText(query).trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return book.pages;
  return book.pages.filter(page => {
    const text = normalizedRuleText(page.text);
    return terms.every(term => text.includes(term));
  });
}

export function ruleBookPageUrl(id: RuleBookId, page: number): string {
  const metadata = ruleBookMetadata(id)!;
  return `${metadata.pdf}#page=${Math.max(1, Math.min(metadata.pageCount, Math.trunc(page) || 1))}`;
}
