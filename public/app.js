const copyAnnouncement = document.querySelector("#copy-announcement");
let announcementTimeout;

function announceCopy(message) {
  if (!copyAnnouncement) return;
  window.clearTimeout(announcementTimeout);
  copyAnnouncement.textContent = message;
  copyAnnouncement.classList.add("is-visible");
  announcementTimeout = window.setTimeout(() => {
    copyAnnouncement.classList.remove("is-visible");
  }, 1800);
}

async function copyText(value) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

document.querySelectorAll("[data-copy-target]").forEach((button) => {
  button.addEventListener("click", async () => {
    const target = document.getElementById(button.dataset.copyTarget);
    const label = button.querySelector("span");
    if (!target || !label) return;

    const original = label.textContent ?? "Copy";
    try {
      await copyText(target.textContent ?? "");
      label.textContent = "Copied";
      announceCopy("Copied to clipboard");
      window.setTimeout(() => {
        label.textContent = original;
      }, 1600);
    } catch {
      announceCopy("Copy failed. Select the text and copy it manually.");
    }
  });
});

function formatNumber(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat("en-US").format(value)
    : "—";
}

function formatStatus(value) {
  return String(value || "unknown")
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function loadStatus() {
  const ledger = document.querySelector("#status-ledger");
  const apiState = document.querySelector("#status-api-state");
  const sourceState = document.querySelector("#status-source-state");
  const launchCount = document.querySelector("#status-launch-count");
  const statusUpdated = document.querySelector("#status-updated");
  const heroStatus = document.querySelector("#hero-api-status");

  if (!ledger) return;

  try {
    const response = await fetch("/api/v1/status", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("Status request failed");

    const payload = await response.json();
    const operational = payload.service === "operational";
    const service = formatStatus(payload.service);
    const freshness = formatStatus(payload.source?.freshness);
    const total = payload.counts?.total;
    const block = payload.source?.snapshot?.blockNumber;

    if (apiState) apiState.textContent = service;
    if (sourceState) {
      sourceState.textContent =
        typeof block === "number"
          ? `${freshness} · block ${formatNumber(block)}`
          : freshness;
    }
    if (launchCount) launchCount.textContent = formatNumber(total);
    if (heroStatus) {
      heroStatus.textContent = operational
        ? `Operational · ${formatNumber(total)} indexed launches`
        : `${service} · inspect live status`;
    }
    if (statusUpdated) {
      const checkedAt = payload.checkedAt ? new Date(payload.checkedAt) : null;
      statusUpdated.textContent =
        checkedAt && !Number.isNaN(checkedAt.valueOf())
          ? `Checked ${checkedAt.toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}`
          : "Status response received";
    }
  } catch {
    if (apiState) apiState.textContent = "Unavailable";
    if (sourceState) sourceState.textContent = "No current response";
    if (heroStatus) heroStatus.textContent = "Status unavailable · documentation remains available";
    if (statusUpdated) statusUpdated.textContent = "Live status could not be loaded.";
  } finally {
    ledger.setAttribute("aria-busy", "false");
  }
}

loadStatus();

const currentYear = document.querySelector("#current-year");
if (currentYear) currentYear.textContent = String(new Date().getFullYear());
