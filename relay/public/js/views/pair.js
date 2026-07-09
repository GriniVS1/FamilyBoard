import { pairDevice, saveSession, ApiError } from "../api.js";
import { t } from "../i18n.js";
import { escapeHtml } from "../ui.js";
import { getArrivalPair, clearArrivalPair } from "../arrival.js";

function browserLabel() {
  const ua = navigator.userAgent;
  let browser = "Browser";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\//.test(ua)) browser = "Opera";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua)) browser = "Safari";

  let device = "";
  if (/iPhone/.test(ua)) device = "iPhone";
  else if (/iPad/.test(ua)) device = "iPad";
  else if (/Android/.test(ua)) device = "Android";
  else if (/Macintosh/.test(ua)) device = "Mac";
  else if (/Windows/.test(ua)) device = "Windows";
  else if (/Linux/.test(ua)) device = "Linux";

  return device ? `${browser} (${device})` : browser;
}

function bullseyeSvg(size) {
  return `<svg class="pair-bullseye" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-width="20"/><circle cx="50" cy="50" r="14" fill="hsl(var(--brand-coral))"/></svg>`;
}

/**
 * @param {HTMLElement} root
 * @param {{ onPaired: () => void }} handlers
 */
export function renderPair(root, { onPaired }) {
  const arrival = getArrivalPair();

  root.innerHTML = `
    <div class="pair-card card">
      <div class="pair-logo">
        <span class="brand-coral">Family</span><span>B</span>${bullseyeSvg(20)}<span>ard</span>
      </div>
      <p class="pair-hint">${escapeHtml(t("pair.subtitle"))}</p>
      <div id="pair-form-area"></div>
    </div>
  `;

  const formArea = root.querySelector("#pair-form-area");

  function renderForm(state) {
    const installationId = state.installationId ?? "";
    const code = state.code ?? "";
    formArea.innerHTML = `
      <form id="pair-form" novalidate>
        <div class="field">
          <label for="pair-installation-id">${escapeHtml(t("pair.installationId"))}</label>
          <input id="pair-installation-id" name="installationId" type="text" autocomplete="off" value="${escapeHtml(installationId)}" />
        </div>
        <div class="field">
          <label for="pair-code">${escapeHtml(t("pair.code"))}</label>
          <input id="pair-code" name="code" type="text" autocomplete="off" autocapitalize="characters" value="${escapeHtml(code)}" />
        </div>
        ${state.error ? `<p class="pair-error" role="alert">${escapeHtml(state.error)}</p>` : ""}
        <button type="submit" class="btn btn-primary" style="width:100%" ${state.pending ? "disabled" : ""}>
          ${state.pending ? escapeHtml(t("pair.pairing")) : escapeHtml(t("pair.submit"))}
        </button>
      </form>
    `;

    formArea.querySelector("#pair-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const idVal = formArea.querySelector("#pair-installation-id").value.trim();
      const codeVal = formArea.querySelector("#pair-code").value.trim();
      submit(idVal, codeVal);
    });
  }

  async function submit(installationId, code) {
    if (!installationId || !code) {
      renderForm({ installationId, code, error: t("pair.missingFields") });
      return;
    }
    renderForm({ installationId, code, pending: true });
    try {
      const data = await pairDevice(installationId, code, `Web (${browserLabel()})`);
      saveSession({
        installationId,
        token: data.token,
        familyName: data.family?.name ?? "",
        memberName: data.member?.name ?? "",
        memberColor: data.member?.color ?? "sand",
        memberEmoji: data.member?.emoji ?? null,
      });
      clearArrivalPair();
      onPaired();
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 400
          ? t("pair.invalid")
          : t("pair.genericError");
      renderForm({ installationId, code, error: message });
    }
  }

  if (arrival) {
    renderForm({ installationId: arrival.installationId, code: arrival.code, pending: true });
    submit(arrival.installationId, arrival.code);
  } else {
    renderForm({});
  }
}
