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

  function render(slots) {
  const root = document.getElementById("slots");
  root.innerHTML = "";

  slots.forEach((s) => {
    const row = document.createElement("div");
    row.className = "row" + (s.is_blocked ? " blocked" : "");

    const start = new Date(s.start_at);
    const end = new Date(s.end_at);

    // 日時表示
    const time = document.createElement("div");
    time.className = "time";
    time.innerHTML = `
      <div><b>${start.toLocaleString()}</b></div>
      <div>〜 ${end.toLocaleString()}</div>
    `;

    // 現在の状態表示
    const status = document.createElement("div");
    status.className = "status";
    status.textContent = s.my_value ?? "-";

    // ○△×ボタン
    const btns = document.createElement("div");
    btns.className = "btns";

    const makeBtn = (label, value) => {
      const btn = document.createElement("button");
      btn.textContent = label;

      if ((s.my_value ?? null) === value) {
        btn.classList.add("active");
      }

      if (s.is_blocked) {
        btn.disabled = true;
      }

      btn.addEventListener("click", () => {
        // ★ ここではDB保存しない（UIだけ）
        s.my_value = value;

        // 画面を再描画（伝助っぽい動き）
        render(slots);
      });

      return btn;
    };

    btns.appendChild(makeBtn("○", "ok"));
    btns.appendChild(makeBtn("△", "maybe"));
    btns.appendChild(makeBtn("×", "ng"));

    row.appendChild(time);
    row.appendChild(status);
    row.appendChild(btns);

    root.appendChild(row);
  });
}

}

async function getOrCreatePerson(lineUserId) {
  // --- GET persons ---
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

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`persons GET failed: ${res.status} ${t}`);
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : [];
  if (data.length > 0) return data[0].id;

  // --- INSERT persons ---
  const insert = await fetch(
    `${SUPABASE_URL}/rest/v1/persons?select=id`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ line_user_id: lineUserId }),
    }
  );

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
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/get_event_timeslots`,
    {
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
    }
  );

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`get_event_timeslots failed: ${res.status} ${t}`);
  }

  return await res.json();
}

function render(slots) {
  const root = document.getElementById("slots");
  root.innerHTML = "";

  slots.forEach((s) => {
    const div = document.createElement("div");
    div.className = "slot" + (s.is_blocked ? " blocked" : "");
    div.innerHTML = `
      <div>${new Date(s.start_at).toLocaleString()} 〜 ${new Date(
        s.end_at
      ).toLocaleString()}</div>
      <div>状態: ${
        s.is_blocked ? "× 確定済みと重複" : s.my_value ?? "-"
      }</div>
    `;
    root.appendChild(div);
  });
}

main();







