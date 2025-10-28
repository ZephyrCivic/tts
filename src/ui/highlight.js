export function renderChunks(container, chunks) {
  container.innerHTML = "";
  const frag = document.createDocumentFragment();
  chunks.forEach((ch, idx) => {
    const span = document.createElement("span");
    span.className = "chunk";
    span.dataset.idx = String(idx);
    span.textContent = ch;
    frag.appendChild(span);
    const sep = document.createElement("span");
    sep.className = "sep";
    sep.textContent = idx < chunks.length - 1 ? "\u2002" : ""; // 1/4 em space
    frag.appendChild(sep);
  });
  container.appendChild(frag);
}

export function setPlaying(container, index) {
  const prev = container.querySelector('.chunk.playing');
  if (prev) prev.classList.remove('playing');
  const cur = container.querySelector(`.chunk[data-idx="${index}"]`);
  if (cur) {
    cur.classList.add('playing');
    cur.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  }
}

