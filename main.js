const SUPABASE_URL = "https://prxyvyawahbtczuyskkq.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByeHl2eWF3YWhidGN6dXlza2txIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MDE4MzksImV4cCI6MjA3NTQ3NzgzOX0.bu12SWZwAFuGAB_7lDzr1mZDBZ5gwURTP8BccNO68oQ";

async function main() {
  await liff.init({ liffId: "2008788331-Py2gq4G8" });

  if (!liff.isLoggedIn()) {
    liff.login({ redirectUri: location.href });
    return;
  }

  const profile = await liff.getProfile();
  const displayName = profile.displayName;
  const lineUserId = profile.userId;

  const urlParams = new URLSearchParams(location.search);
  const eventId = urlParams.get("event");
  if (!eventId) {
    alert("event_id がありません");
    return;
  }

  // タイトルに名前表示
  document.getElementById("title").textContent =
    `イベント（あなた：${displayName}）`;

  // person 取得 or 作成（名前も保存）
  const personId = await getOrCreatePerson(lineUserId, displayName);

  // timeslots 取得
  const slots = await getEventTimeslots(eventId, personId);

  // 描画
  render(slots, eventId, personId);
}

/* ---------- persons ---------- */

async function getOrCreatePerson(lineUserId, displayName) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/persons?select=id&line_user_id=eq.${encodeURIComponent(
      lineUserId
    )}`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }
  );

  const text = await res.text();
  const data = text ? JSON.parse(text) : [];

  // 既存 → 名前を最新化
  if (data.length > 0) {
    const personId = data[0].id;

    await fetch(`${SUPABASE_URL}/rest/v1/persons?id=eq.${personId}`, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ display_name: displayName }),
    });

    return personId;
  }

  // 新規作成
  const insert = await fetch(`${SUPABASE_URL}/rest/v1/persons?select=id`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      line_user_id: lineUserId,
      display_name: displayName,
    }),
  });

  const insertText = await insert.text();
  const created = insertText ? JSON.parse(insertText) : [];
  return created[0].id;
}

/* ---------- timeslots ---------- */

async function getEventTimeslots(eventId, personId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_event_timeslots`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_event_id: eventId,
      p_person_id: personId,
    }),
  });

  return await res.json();
}

/* ---------- responses ---------- */

async function saveResponse({ eventId, timeslotId, personId, value }) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/responses`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify([
      {
        event_id: eventId,
        timeslot_id: timeslotId,
        person_id: personId,
        value, // o / tri / x
      },
    ]),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(t);
  }
}

/* ---------- UI ---------- */

function render(slots, eventId, personId) {
  const root = document.getElementById("slots");
  root.innerHTML = "";

  slots.forEach((s) => {
    const row = document.createElement("div");
    row.className = "row" + (s.is_blocked ? " blocked" : "");

    const start = new Date(s.start_at);
    const end = new Date(s.end_at);

    const time = document.createElement("div");
    time.className = "time";
    time.innerHTML = `
      <div><b>${start.toLocaleString()}</b></div>
      <div class="muted">〜 ${end.toLocaleString()}</div>
    `;

    const status = document.createElement("div");
    status.className = "status";
    status.textContent = s.my_value ?? "-";

    const btns = document.createElement("div");
    btns.className = "btns";

    const timeslotId = s.timeslot_id ?? s.id;

    const makeBtn = (label, value) => {
      const btn = document.createElement("button");
      btn.textContent = label;

      if (s.my_value === value) btn.classList.add("active");
      if (s.is_blocked) btn.disabled = true;

      btn.onclick = async () => {
        s.my_value = value;
        render(slots, eventId, personId);

        try {
          await saveResponse({
            eventId,
            timeslotId,
            personId,
            value,
          });
        } catch (e) {
          console.error(e);
          alert("保存に失敗しました");
        }
      };

      return btn;
    };

    // enum に合わせる（重要）
    btns.appendChild(makeBtn("○", "o"));
    btns.appendChild(makeBtn("△", "tri"));
    btns.appendChild(makeBtn("×", "x"));

    row.appendChild(time);
    row.appendChild(status);
    row.appendChild(btns);

    root.appendChild(row);
  });
}

main();
