const announcement = document.getElementById("copy-announcement");

async function copy(button, readText) {
  const label = button.textContent;
  button.disabled = true;
  try {
    await navigator.clipboard.writeText(await readText());
    button.textContent = "Copied";
    announcement.textContent = "Copied to clipboard.";
  } catch {
    button.textContent = "Copy failed";
    announcement.textContent = "Copy failed. Select the code or open Read Markdown to copy the text manually.";
  } finally {
    button.disabled = false;
    setTimeout(() => { button.textContent = label; }, 2500);
  }
}

if (navigator.clipboard?.writeText) {
  for (const button of document.querySelectorAll("[data-copy-code]")) {
    button.hidden = false;
    button.addEventListener("click", () => copy(button, () =>
      document.getElementById(button.dataset.copyCode).textContent));
  }
  const pageButton = document.getElementById("copy-page");
  pageButton.hidden = false;
  pageButton.addEventListener("click", () => copy(pageButton, async () => {
    const response = await fetch("/robinhood-terminal-indexer.md");
    if (!response.ok) throw new Error("Markdown unavailable");
    return response.text();
  }));
}
