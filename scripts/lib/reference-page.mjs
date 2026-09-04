import { Marked } from "marked";

const escapeHtml = (value) => value.replace(/[&<>"']/gu, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[character]));

/** Render the repository-owned Markdown once for browsers and machine clients. */
export function renderRobinhoodReference(markdown) {
  const sections = [];
  const ids = new Set();
  const previousAnchors = { classification: "contract", "index-launches": "integration", "verification-results": "verification", "reference-files": "resources", "verify-a-token": "example" };
  let codeIndex = 0;
  const marked = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth, text }) {
        const id = text.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");
        if (ids.has(id)) throw new Error(`Duplicate reference heading: ${id}`);
        ids.add(id);
        if (depth === 2) sections.push({ id, text });
        const previousAnchor = previousAnchors[id];
        return `${previousAnchor ? `<span id="${previousAnchor}" class="anchor-alias"></span>` : ""}<h${depth} id="${id}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
      },
      code({ text, lang }) {
        const id = `example-${++codeIndex}`;
        return `<div class="code-example">
  <div class="code-toolbar"><span>${escapeHtml(lang || "text")}</span><button type="button" data-copy-code="${id}" aria-label="Copy code example ${codeIndex}" hidden>Copy</button></div>
  <pre tabindex="0" aria-label="Code example ${codeIndex}"><code id="${id}">${escapeHtml(text)}</code></pre>
</div>\n`;
      },
      // Raw HTML is unnecessary in this reference. Keep its Markdown text literal.
      html({ text }) { return escapeHtml(text); },
    },
  });
  const content = marked.parse(markdown, { async: false });
  const navigation = sections.map(({ id, text }) =>
    `<a href="#${id}">${escapeHtml(text)}</a>`).join("\n          ");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Robinhood terminal integration | Programmable Docs</title>
    <meta name="description" content="Reference for verifying and indexing Programmable Custom launch stamps on Robinhood Chain: commands, classification, finality and schemas." />
    <meta name="color-scheme" content="light dark" />
    <meta property="og:title" content="Robinhood terminal integration | Programmable Docs" />
    <meta property="og:description" content="Commands and verification rules for Programmable Custom tokens on chain 4663." />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="https://developers.programmable.family/robinhood-terminal-indexer" />
    <link rel="canonical" href="https://developers.programmable.family/robinhood-terminal-indexer" />
    <link rel="alternate" type="text/markdown" title="Markdown" href="/robinhood-terminal-indexer.md" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="/reference.css" />
    <script src="/reference.js" defer></script>
  </head>
  <body>
    <a class="skip-link" href="#main-content">Skip to content</a>
    <header class="site-header">
      <a class="site-name" href="/">Programmable <span>Docs</span></a>
      <a href="https://github.com/programmablehq/Developers">GitHub</a>
    </header>
    <div class="reference-layout">
      <nav class="contents" aria-label="On this page">
        <p>On this page</p>
        <div>
          ${navigation}
        </div>
      </nav>
      <main id="main-content" tabindex="-1">
        <div class="document-tools" aria-label="Document formats">
          <a href="/robinhood-terminal-indexer.md">Read Markdown</a>
          <button type="button" id="copy-page" hidden>Copy page</button>
          <a href="https://github.com/programmablehq/Developers/blob/main/docs/guides/robinhood-terminal-indexer.md">View source</a>
        </div>
        <details class="mobile-contents">
          <summary>On this page</summary>
          <nav aria-label="On this page">${navigation}</nav>
        </details>
        <article>
${content}
        </article>
        <footer><a href="https://github.com/programmablehq/Developers/issues">Report a documentation issue</a></footer>
      </main>
    </div>
    <p class="copy-announcement" id="copy-announcement" role="status" aria-live="polite"></p>
  </body>
</html>
`;
}
