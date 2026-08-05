const FEE_BENEFICIARY = "0x4957f49620AFf3Adbbe8195a4f633E49cc93376c";
const SAMPLE_TOKEN = "0x1111111111111111111111111111111111111111";
const SAMPLE_TRANSACTION = `0x${"2".repeat(64)}`;
const SAMPLE_POOL = `0x${"3".repeat(64)}`;

const baseSample = {
  schemaVersion: "1.0.0",
  platformId: "programmable",
  launchId: `eip155:1:${SAMPLE_TOKEN}`,
  category: "classic",
  chainId: 1,
  token: {
    address: SAMPLE_TOKEN,
    identityStatus: "complete",
    name: "Example token",
    symbol: "EXAMPLE",
    decimals: 18,
    totalSupplyRaw: "1000000000000000000000000000",
    supplyStatus: "verified",
    supplyAsOfBlock: "26000000",
    metadata: {
      description: null,
      imageUrl: null,
      links: null,
      trustStatus: "unavailable",
    },
  },
  launch: {
    status: "live",
    origin: "first-party",
    modelId: "classic",
    modelVersion: "3",
    publicSubmission: false,
    creatorAddress: "0x6666666666666666666666666666666666666666",
    transactionHash: SAMPLE_TRANSACTION,
    blockNumber: "26000000",
    blockHash: `0x${"7".repeat(64)}`,
    logIndex: 0,
    timestamp: "2026-08-04T12:00:00.000Z",
    finality: "finalized",
  },
  verification: {
    sourceId: "ethereum-classic-v3",
    launcherAddress: "0x8888888888888888888888888888888888888888",
    registryAddress: null,
    provenanceStatus: "verified",
    sourceUrl: "https://developers.programmable.family/",
  },
  capabilities: [
    {
      id: "launch-discovery",
      version: "1.0.0",
      status: "active",
      parameters: {},
    },
  ],
  markets: [],
  fees: [
    {
      kind: "platform",
      ratePpm: 1000,
      rateBps: 10,
      recipient: FEE_BENEFICIARY,
      chargeMode: "included",
      basis: "settled-quote-notional",
      assetAddress: null,
      verificationStatus: "verified",
    },
  ],
  extensions: {},
};

const activeV4Market = {
  marketId: "eip155:1:uniswap-v4:sample",
  kind: "uniswap-v4",
  status: "active",
  baseTokenAddress: SAMPLE_TOKEN,
  quoteTokenAddress: "0x9999999999999999999999999999999999999999",
  protocol: "uniswap-v4",
  poolId: SAMPLE_POOL,
  poolAddress: null,
  hookAddress: "0x4444444444444444444444444444444444444444",
  support: {
    discovery: "available",
    charting: "unknown",
    quote: "unknown",
    simulation: "unknown",
    execution: "unknown",
  },
  adapter: {
    kind: "read-model",
    version: "1.0.0",
    adapterId: "programmable-v4-market-v1",
    verificationStatus: "verified",
  },
  metrics: {
    price: { value: null, status: "unavailable" },
    liquidity: { value: null, status: "unavailable" },
    volume24h: { value: null, status: "unavailable" },
    updatedAt: null,
  },
};

function customPrelaunch(overrides = {}) {
  return {
    ...baseSample,
    category: "custom",
    launch: {
      ...baseSample.launch,
      status: "prelaunch",
      origin: "public-submission",
      modelId: "custom",
      modelVersion: null,
      publicSubmission: true,
      transactionHash: null,
      blockNumber: null,
      blockHash: null,
      logIndex: null,
      timestamp: null,
      finality: null,
    },
    verification: {
      sourceId: "programmable-custom-registry",
      launcherAddress: null,
      registryAddress: null,
      provenanceStatus: "prelaunch",
      sourceUrl: "https://developers.programmable.family/",
    },
    capabilities: [
      {
        id: "launch-discovery",
        version: "1.0.0",
        status: "conditional",
        parameters: {},
      },
    ],
    fees: [
      {
        kind: "platform",
        ratePpm: 1000,
        rateBps: 10,
        recipient: FEE_BENEFICIARY,
        chargeMode: "added-on-top",
        basis: "settled-quote-notional",
        assetAddress: null,
        verificationStatus: "prelaunch",
      },
    ],
    ...overrides,
  };
}

const samples = {
  classic: {
    label: "Classic · normalized record",
    data: {
      ...baseSample,
      category: "classic",
      markets: [activeV4Market],
    },
  },
  customPool: {
    label: "Custom pool · same envelope",
    data: customPrelaunch({
      markets: [
        {
          ...activeV4Market,
          marketId: "eip155:1:uniswap-v4:custom-sample",
          kind: "uniswap-v4",
          status: "planned",
          poolId: null,
          poolAddress: null,
          support: {
            discovery: "available",
            charting: "unknown",
            quote: "unknown",
            simulation: "unknown",
            execution: "unknown",
          },
          adapter: {
            kind: "read-model",
            version: null,
            adapterId: "programmable-custom-v4-preview",
            verificationStatus: "prelaunch",
          },
        },
      ],
      extensions: {
        "programmable/custom": {
          sampleType: "pool",
        },
      },
    }),
  },
  customNoPool: {
    label: "Custom without pool · same envelope",
    data: customPrelaunch({
      markets: [],
      extensions: {
        "programmable/custom": {
          sampleType: "no-market",
        },
      },
    }),
  },
  contractMarket: {
    label: "Custom contract market · same envelope",
    data: customPrelaunch({
      markets: [
        {
          marketId: "eip155:1:contract-market:sample",
          kind: "contract-market",
          status: "planned",
          baseTokenAddress: SAMPLE_TOKEN,
          quoteTokenAddress: "0x9999999999999999999999999999999999999999",
          protocol: "contract-defined",
          poolId: null,
          poolAddress: null,
          hookAddress: null,
          support: {
            discovery: "available",
            charting: "unknown",
            quote: "unknown",
            simulation: "unknown",
            execution: "unavailable",
          },
          adapter: null,
          metrics: {
            price: { value: null, status: "unavailable" },
            liquidity: { value: null, status: "unavailable" },
            volume24h: { value: null, status: "unavailable" },
            updatedAt: null,
          },
        },
      ],
      extensions: {
        "programmable/custom": {
          sampleType: "contract-market",
          marketAddress: "0x5555555555555555555555555555555555555555",
        },
      },
    }),
  },
};

const tabs = Array.from(document.querySelectorAll('[role="tab"][data-sample]'));
const samplePanel = document.querySelector("#sample-panel");
const sampleJson = document.querySelector("#sample-json");
const sampleCaption = document.querySelector("#sample-caption");

function selectSample(tab, { focus = false } = {}) {
  const sample = samples[tab.dataset.sample];
  if (!sample || !samplePanel || !sampleJson || !sampleCaption) return;

  tabs.forEach((candidate) => {
    const selected = candidate === tab;
    candidate.setAttribute("aria-selected", String(selected));
    candidate.tabIndex = selected ? 0 : -1;
  });

  samplePanel.setAttribute("aria-labelledby", tab.id);
  sampleCaption.textContent = sample.label;
  sampleJson.textContent = JSON.stringify(sample.data, null, 2);

  if (focus) tab.focus();
}

tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => selectSample(tab));
  tab.addEventListener("keydown", (event) => {
    let nextIndex = null;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (index + 1) % tabs.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (index - 1 + tabs.length) % tabs.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = tabs.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    selectSample(tabs[nextIndex], { focus: true });
  });
});

if (tabs[0]) selectSample(tabs[0]);

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

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
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
    if (!target) return;

    const label = button.querySelector("span");
    const originalLabel = label?.textContent ?? "Copy";

    try {
      await copyText(target.textContent ?? "");
      if (label) label.textContent = "Copied";
      announceCopy("Copied to clipboard");
      window.setTimeout(() => {
        if (label) label.textContent = originalLabel;
      }, 1600);
    } catch {
      announceCopy("Copy failed. Select the text and copy it manually.");
    }
  });
});

const statusLedger = document.querySelector("#status-ledger");
const statusApiState = document.querySelector("#status-api-state");
const statusSourceState = document.querySelector("#status-source-state");
const statusLaunchCount = document.querySelector("#status-launch-count");
const statusSchema = document.querySelector("#status-schema");
const statusUpdated = document.querySelector("#status-updated");
const heroApiStatus = document.querySelector("#hero-api-status");

function formatNumber(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat("en-US").format(value)
    : "—";
}

function formatStatusLabel(status) {
  return String(status || "unknown")
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function loadStatus() {
  if (!statusLedger) return;

  try {
    const response = await fetch("/api/v1/status", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Status returned ${response.status}`);

    const payload = await response.json();
    const isReady = payload.service === "operational";
    const statusLabel = formatStatusLabel(payload.service);
    const freshness = payload.source?.freshness ?? "unavailable";
    const total = payload.counts?.total;
    const blockNumber = payload.source?.snapshot?.blockNumber;

    if (statusApiState) {
      statusApiState.textContent = statusLabel;
      statusApiState.className = `status-value ${isReady ? "status-value-ready" : "status-value-pending"}`;
    }
    if (statusSourceState) {
      const blockLabel = typeof blockNumber === "number" ? ` · block ${formatNumber(blockNumber)}` : "";
      statusSourceState.textContent = `${formatStatusLabel(freshness)}${blockLabel}`;
    }
    if (statusLaunchCount) statusLaunchCount.textContent = formatNumber(total);
    if (statusSchema) statusSchema.textContent = payload.schemaVersion ?? "v1";
    if (statusUpdated) {
      const checkedAt = payload.checkedAt ? new Date(payload.checkedAt) : null;
      statusUpdated.textContent = checkedAt && !Number.isNaN(checkedAt.valueOf())
        ? `Status checked ${checkedAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`
        : "Status response received";
    }
    if (heroApiStatus) {
      heroApiStatus.textContent = isReady
        ? `Ready · ${formatNumber(total)} indexed launches`
        : `${statusLabel} · inspect live status`;
    }
  } catch {
    if (statusApiState) {
      statusApiState.textContent = "Unavailable";
      statusApiState.className = "status-value status-value-error";
    }
    if (statusSourceState) statusSourceState.textContent = "No current response";
    if (statusUpdated) statusUpdated.textContent = "Live status could not be loaded. Static documentation remains available.";
    if (heroApiStatus) heroApiStatus.textContent = "Status unavailable · documentation remains available";
  } finally {
    statusLedger.setAttribute("aria-busy", "false");
  }
}

loadStatus();

const currentYear = document.querySelector("#current-year");
if (currentYear) currentYear.textContent = String(new Date().getFullYear());

document.querySelectorAll(".mobile-menu nav a").forEach((link) => {
  link.addEventListener("click", () => {
    const menu = link.closest("details");
    if (menu) menu.open = false;
  });
});
