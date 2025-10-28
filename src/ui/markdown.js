const BLOCK_TAGS = new Set(["h1","h2","h3","h4","h5","h6","p","ul","ol","pre","blockquote","hr"]);

function escapeHtml(str) {
  const input = str ?? "";
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function applyInline(text) {
  if (!text) return "";
  let out = text;
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__(.+?)__/g, "<strong>$1</strong>");
  out = out.replace(/\*(?!\*)([^*]+)\*/g, "<em>$1</em>");
  out = out.replace(/_(?!_)([^_]+)_/g, "<em>$1</em>");
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/!\[([^\]]*?)\]\(([^)]+)\)/g, (m, alt) => `<span class="md-img">[画像:${alt}]</span>`);
  out = out.replace(/\[([^\]]+?)\]\(([^)\s]+)(?:\s+\"([^\"]+)\")?\)/g, (m, text, url, title) => {
    const safeUrl = /^https?:\/\//i.test(url) ? url : "";
    const titleAttr = title ? ` title="${title}"` : "";
    return safeUrl ? `<a href="${safeUrl}" target="_blank" rel="noopener"${titleAttr}>${text}</a>` : text;
  });
  return out;
}

export function markdownToHtml(markdown) {
  if (!markdown) return "";
  const normalized = markdown.replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  const out = [];
  let paragraph = [];
  let inCode = false;
  let codeLang = "";
  let codeBuffer = [];
  let listType = null;
  let listBuffer = [];
  let blockquoteBuffer = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    out.push(`<p>${applyInline(paragraph.join("<br />"))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!listType || !listBuffer.length) return;
    out.push(`<${listType}>${listBuffer.join("")}</${listType}>`);
    listType = null;
    listBuffer = [];
  };

  const flushBlockquote = () => {
    if (!blockquoteBuffer.length) return;
    const content = blockquoteBuffer.map((line) => applyInline(line)).join("<br />");
    out.push(`<blockquote><p>${content}</p></blockquote>`);
    blockquoteBuffer = [];
  };

  const flushCode = () => {
    if (!inCode) return;
    const langClass = codeLang ? ` class="language-${codeLang}"` : "";
    out.push(`<pre><code${langClass}>${codeBuffer.join("\n")}</code></pre>`);
    inCode = false; codeLang = ""; codeBuffer = [];
  };

  const finishLineBlock = () => {
    flushParagraph();
    flushList();
    flushBlockquote();
  };

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (trimmed.startsWith("```")) {
      if (inCode) {
        flushCode();
      } else {
        finishLineBlock();
        inCode = true;
        codeLang = trimmed.slice(3).trim().replace(/[^0-9a-zA-Z\-+#.]/g, "");
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(escapeHtml(raw));
      continue;
    }

    if (!trimmed) {
      finishLineBlock();
      continue;
    }

    if (/^\s*>/.test(raw)) {
      flushParagraph();
      flushList();
      const withoutMarker = raw.replace(/^\s*>\s?/, "");
      blockquoteBuffer.push(escapeHtml(withoutMarker));
      continue;
    }

    if (/^\s*([-*+])\s+/.test(raw)) {
      flushParagraph();
      flushBlockquote();
      const currentType = "ul";
      if (listType && listType !== currentType) flushList();
      listType = currentType;
      const content = raw.replace(/^\s*[-*+]\s+/, "");
      listBuffer.push(`<li>${applyInline(escapeHtml(content))}</li>`);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(raw)) {
      flushParagraph();
      flushBlockquote();
      const currentType = "ol";
      if (listType && listType !== currentType) flushList();
      listType = currentType;
      const content = raw.replace(/^\s*\d+\.\s+/, "");
      listBuffer.push(`<li>${applyInline(escapeHtml(content))}</li>`);
      continue;
    }

    if (/^\s*---+$/.test(trimmed)) {
      finishLineBlock();
      out.push("<hr />");
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = Math.min(headingMatch[1].length, 6);
      const content = escapeHtml(headingMatch[2]);
      finishLineBlock();
      out.push(`<h${level}>${applyInline(content)}</h${level}>`);
      continue;
    }

    flushBlockquote();
    flushList();
    paragraph.push(escapeHtml(raw));
  }

  flushCode();
  finishLineBlock();

  return out.join("\n");
}

export function markdownToPlainText(markdown) {
  if (!markdown) return "";
  const html = markdownToHtml(markdown);
  if (!html) return markdown;
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent ? tmp.textContent.trim() : "";
}

export function hasBlockContent(html) {
  if (!html) return false;
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  if (tmp.textContent && tmp.textContent.trim()) return true;
  return Array.from(tmp.children).some((child) => BLOCK_TAGS.has(child.tagName.toLowerCase()) || child.textContent.trim());
}

