const Q = {
  g1: { type: "radio", options: [
    ["this_week", "This week"], ["two_weeks", "In the last 2 weeks"], ["month", "In the last month"],
    ["longer", "Longer ago"], ["never", "Never"] ] },
  g2who: { type: "radio", options: [
    ["me", "Me"], ["colleague", "A colleague in the office"], ["quoting_team", "The conveyancing or quoting team"], ["not_sure", "Not sure"] ] },
  g2self: { type: "radio", options: [["yes", "Yes"], ["maybe", "Maybe"], ["no", "No"]] },
  g3: { type: "radio", options: [["app", "Install an app"], ["web", "Use a web page"], ["either", "Either is fine"]] },
  g4: { type: "checkbox", options: [
    ["opened", "Client opened the quotes"], ["instructed", "Client instructed a firm"], ["expiring", "Quotes about to expire"], ["none", "None of these"] ] },
  g5: { type: "radio", options: [["often", "Yes, often"], ["sometimes", "Sometimes"], ["no", "No, same fee every time"]] },
};
const TEXT_FIELDS = ["g3why", "g5how", "notes"];
const REQUIRED = ["g1", "g2who", "g2self", "g3", "g4", "g5"];

// The PRO-16156 go/no-go pass criteria, worked out per response so the sheet can count them.
const GATES = {
  g1Pass: r => ["this_week", "two_weeks"].includes(r.g1),
  g2Pass: r => r.g2self === "yes",
  g3Pass: r => r.g3 === "app",
  g4Pass: r => r.g4.some(v => v === "opened" || v === "instructed"),
};

const form = document.getElementById("survey");
const DRAFT_KEY = "agent-quoting-draft";
const $ = id => document.getElementById(id);

function buildOptions() {
  for (const [key, q] of Object.entries(Q)) {
    const box = $(key);
    q.options.forEach(([value, text], i) => {
      const label = document.createElement("label");
      label.className = "opt";
      const input = document.createElement("input");
      input.type = q.type; input.name = key; input.value = value; input.id = `${key}-${i}`;
      const span = document.createElement("span");
      span.textContent = text;
      label.append(input, span);
      box.append(label);
    });
  }
}

function read() {
  const fd = new FormData(form);
  const r = {
    name: (fd.get("name") || "").trim(),
    agency: (fd.get("agency") || "").trim(),
    email: (fd.get("email") || "").trim(),
    updates: fd.get("updates") === "yes",
  };
  for (const [key, q] of Object.entries(Q)) r[key] = q.type === "checkbox" ? fd.getAll(key) : (fd.get(key) || "");
  for (const key of TEXT_FIELDS) r[key] = (fd.get(key) || "").trim();
  return r;
}

function write(r) {
  const f = form.elements;
  f.namedItem("name").value = r.name || "";
  f.namedItem("agency").value = r.agency || "";
  f.namedItem("email").value = r.email || "";
  f.namedItem("updates").checked = !!r.updates;
  for (const [key, q] of Object.entries(Q)) {
    form.querySelectorAll(`input[name="${key}"]`).forEach(el => {
      el.checked = q.type === "checkbox" ? (r[key] || []).includes(el.value) : r[key] === el.value;
    });
  }
  for (const key of TEXT_FIELDS) f.namedItem(key).value = r[key] || "";
}

function isAnswered(r, key) {
  return Array.isArray(r[key]) ? r[key].length > 0 : !!r[key];
}

function sync() {
  const r = read();
  let n = 0;
  for (const key of REQUIRED) {
    const done = isAnswered(r, key);
    form.querySelector(`[data-q="${key}"]`).classList.toggle("answered", done);
    if (done) n++;
  }
  $("barFill").style.width = `${(n / REQUIRED.length) * 100}%`;
  $("progressText").textContent = `${n} of ${REQUIRED.length}`;
  $("g5howWrap").hidden = r.g5 === "no";
}

function textOf(key, value) {
  const opt = Q[key].options.find(([v]) => v === value);
  return opt ? opt[1] : "";
}

// What the sheet receives: readable answers plus the four pass flags.
function payload(r) {
  const out = {
    name: r.name,
    agency: r.agency,
    g1: textOf("g1", r.g1),
    g2who: textOf("g2who", r.g2who),
    g2self: textOf("g2self", r.g2self),
    g3: textOf("g3", r.g3),
    g3why: r.g3why,
    g4: r.g4.map(v => textOf("g4", v)).join(", "),
    g5: textOf("g5", r.g5),
    g5how: r.g5 === "no" ? "" : r.g5how,
    notes: r.notes,
    email: r.email,
    updates: r.updates,
    website: form.elements.namedItem("website").value,
  };
  for (const [k, test] of Object.entries(GATES)) out[k] = test(r);
  return out;
}

function saveDraft() { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(read())); } catch (e) {} }
function loadDraft() { try { const s = localStorage.getItem(DRAFT_KEY); if (s) write(JSON.parse(s)); } catch (e) {} }
function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} }

function problem(r) {
  const emailInput = form.elements.namedItem("email");
  if (!r.name) return { msg: "Add your name.", el: form.elements.namedItem("name") };
  if (r.updates && !r.email) return { msg: "Add your email so we can tell you when the app goes live.", el: emailInput };
  if (r.email && !emailInput.checkValidity()) return { msg: "Check your email address.", el: emailInput };
  for (const key of REQUIRED) {
    if (!isAnswered(r, key)) return { msg: "Answer every question from 1 to 6.", el: form.querySelector(`[data-q="${key}"]`) };
  }
  return null;
}

async function send(data) {
  // text/plain keeps this a simple request, so the browser skips the CORS preflight Apps Script can't answer.
  const res = await fetch(window.SURVEY_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(data),
  });
  const body = await res.json();
  if (!body.ok) throw new Error(body.error || "Not saved");
}

async function submit(e) {
  e.preventDefault();
  const status = $("formStatus");
  const btn = $("submitBtn");
  const r = read();
  const p = problem(r);
  if (p) {
    status.className = "status error"; status.textContent = p.msg;
    p.el.scrollIntoView({ block: "center", behavior: "smooth" });
    return;
  }
  if (!window.SURVEY_ENDPOINT) {
    status.className = "status error"; status.textContent = "This survey isn't open yet.";
    return;
  }

  btn.disabled = true;
  status.className = "status"; status.textContent = "Sending…";
  try {
    await send(payload(r));
  } catch (err) {
    status.className = "status error";
    status.textContent = "We couldn't send your answers. Check your connection and try again.";
    btn.disabled = false;
    return;
  }

  clearDraft();
  $("thanksTitle").textContent = r.name ? `Thank you, ${r.name.split(/\s+/)[0]}` : "Thank you";
  form.hidden = true;
  document.querySelector(".progress").hidden = true;
  $("done").hidden = false;
  $("formCard").scrollIntoView({ block: "start", behavior: "smooth" });
}

buildOptions();
loadDraft();
sync();
form.addEventListener("input", () => { saveDraft(); sync(); });
form.addEventListener("change", () => { saveDraft(); sync(); });
form.addEventListener("submit", submit);
