/**
 * Payment Banner Hider — Standalone Script
 *
 * Auto-runs on lovable.dev/* pages. Detects the sticky banner at
 * /html/body/div[2]/main/div/div[1] and, if it contains the text
 * "Payment issue detected.", smoothly fades it to black and hides it
 * within ~1 second using a CSS3 transition.
 *
 * Behavior:
 *  - Runs immediately on inject (DOM may already be ready)
 *  - Re-runs via MutationObserver to handle React re-renders / SPA navigation
 *  - Marks already-handled banners with a data attribute to prevent re-work
 *  - Uses display:none after the fade so layout space is released
 *
 * No external dependencies. Pure DOM + CSS3.
 */

const VERSION = "1.0.0";
const TARGET_TEXT = "Payment issue detected.";
const TARGET_XPATH = "/html/body/div[2]/main/div/div[1]";
const HANDLED_ATTR = "data-payment-banner-hidden";
const STYLE_ID = "payment-banner-hider-styles";
const TRANSITION_MS = 900;
const REMOVE_DELAY_MS = 1000;

/** Inject the keyframe + transition rules once. */
function injectStyles(): void {
    if (document.getElementById(STYLE_ID)) {
        return;
    }
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
        [${HANDLED_ATTR}="fading"] {
            background-color: #000 !important;
            background-image: none !important;
            color: #fff !important;
            transition:
                background-color 250ms ease-in,
                color 250ms ease-in,
                opacity ${TRANSITION_MS}ms ease-out,
                max-height ${TRANSITION_MS}ms ease-out,
                margin ${TRANSITION_MS}ms ease-out,
                padding ${TRANSITION_MS}ms ease-out !important;
        }
        [${HANDLED_ATTR}="fading"] * {
            background-color: transparent !important;
            color: #fff !important;
        }
        [${HANDLED_ATTR}="hiding"] {
            opacity: 0 !important;
            max-height: 0 !important;
            margin-top: 0 !important;
            margin-bottom: 0 !important;
            padding-top: 0 !important;
            padding-bottom: 0 !important;
            overflow: hidden !important;
            pointer-events: none !important;
        }
        [${HANDLED_ATTR}="done"] {
            display: none !important;
        }
    `;
    (document.head || document.documentElement).appendChild(style);
}

/** Resolve the target node via XPath. */
function getTargetNode(): HTMLElement | null {
    try {
        const result = document.evaluate(
            TARGET_XPATH,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null,
        );
        const node = result.singleNodeValue;
        return node instanceof HTMLElement ? node : null;
    } catch {
        return null;
    }
}

/** Begin the fade-and-hide sequence on a matched banner. */
function hideBanner(el: HTMLElement): void {
    if (el.getAttribute(HANDLED_ATTR)) {
        return;
    }
    el.setAttribute(HANDLED_ATTR, "fading");
    // Force a paint, then trigger the collapse on the next frame.
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            el.setAttribute(HANDLED_ATTR, "hiding");
        });
    });
    window.setTimeout(() => {
        el.setAttribute(HANDLED_ATTR, "done");
    }, REMOVE_DELAY_MS);
}

/** Check the XPath target; if it matches, hide it. */
function checkAndHide(): void {
    const target = getTargetNode();
    if (!target) {
        return;
    }
    if (target.getAttribute(HANDLED_ATTR)) {
        return;
    }
    const text = target.textContent || "";
    if (!text.includes(TARGET_TEXT)) {
        return;
    }
    hideBanner(target);
}

/** Watch for SPA re-renders and dynamically inserted banners. */
function startObserver(): void {
    const observer = new MutationObserver(() => {
        checkAndHide();
    });
    const root = document.body || document.documentElement;
    observer.observe(root, {
        childList: true,
        subtree: true,
        characterData: true,
    });
}

/** Public namespace exposed on window for debugging. */
const PaymentBannerHider = {
    version: VERSION,
    check: checkAndHide,
};

(window as unknown as { PaymentBannerHider: typeof PaymentBannerHider }).PaymentBannerHider =
    PaymentBannerHider;

// ── Auto-run ──
injectStyles();
checkAndHide();
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        checkAndHide();
        startObserver();
    });
} else {
    startObserver();
}

export { checkAndHide, PaymentBannerHider };
