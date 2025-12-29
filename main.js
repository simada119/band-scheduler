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

  const urlParams = new URLSearchParams(location.search);
  const eventId = urlParams.get("event");
  if (!eventId) {
    alert("event_id がありません");
    return;
  }

  const lineUserId = profile.userId;

  // 1) person を取得 or 作成
  const personId = await getOrCreatePerson(lineUserId);

  // 2) timeslots を取得
  const slots = await getEventTimeslots(eventId, personId);

  // 3) 伝助UIで描画（押したらDBに保存）
  render(slots, eventId, personId);
}


  // --- INSERT persons ---

async function getOrCreatePerson(lineUserId, displayName) {
  // --- GET persons ---
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/persons?select=id,display_name&line_user_id=eq.${encodeURIComponent(
      lineUserId
    )}`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }
  );

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`persons GET failed: ${res.status} ${t}`);
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : [];

  // すでに存在する場合 → 名前だけ最新化
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

  // --- INSERT persons ---
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

  if (!insert.ok) {
    const t = await insert.text();
    throw new Error(`persons POST failed: ${insert.status} ${t}`);
  }

  const insertText = await insert.text();
  const created = insertText ? JSON.parse(insertText) : [];
  if (!created[0]) throw new Error("persons POST succeeded but empty response");

  return created[0].id;
}


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

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`get_event_timeslots failed: ${res.status} ${t}`);
  }

  return await res.json();
}

// responses に upsert（同じ event_id + timeslot_id + person_id は上書き）
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
        value,
      },
    ]),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`saveResponse failed: ${res.status} ${t}`);
  }

  return await res.json();
}

// ✅ 伝助っぽいUI（○△×ボタン）
// ※ 押したらDB保存する
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

    // ★ timeslotのID（RPCの返り値に合わせて拾う）
    const timeslotId = s.timeslot_id ?? s.id;

    const makeBtn = (label, value) => {
      const btn = document.createElement("button");
      btn.textContent = label;

      if ((s.my_value ?? null) === value) btn.classList.add("active");
      if (s.is_blocked) btn.disabled = true;

      btn.addEventListener("click", async () => {
        if (!timeslotId) {
          console.warn("timeslotId not found in slot:", s);
          alert("timeslotId が見つかりません（RPCの返り値にIDが必要です）");
          return;
        }

        // 1) 先にUI反映（伝助っぽさ優先）
        s.my_value = value;
        render(slots, eventId, personId);

        // 2) DB保存
        try {
          await saveResponse({ eventId, timeslotId, personId, value });
        } catch (e) {
          console.error(e);
          alert("保存に失敗しました。Consoleを確認してください。");
        }
      });

      return btn;
    };

  
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


