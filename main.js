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

  // タイトルに自分の名前を表示
  const titleEl = document.getElementById("title");
  if (titleEl) titleEl.textContent = `イベント（あなた：${displayName}）`;

  // 1) person を取得 or 作成（名前も保存）
  const personId = await getOrCreatePerson(lineUserId, displayName);

  // 2) timeslots を取得（自分の回答my_valueもここで返ってくる想定）
  const slots = await getEventTimeslots(eventId, personId);
async function getEvent(eventId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/events?select=id,title,deadline_at,status&id=eq.${encodeURIComponent(eventId)}`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }
  );

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`events GET failed: ${res.status} ${t}`);
  }

  const data = await res.json();
  return data[0]; // 1件
}

  // 3) 集計を取得して slots に合体
  const counts = await getTimeslotCounts(eventId);
  const map = new Map(counts.map((c) => [c.timeslot_id, c]));

  slots.forEach((s) => {
    const tid = s.timeslot_id ?? s.id;
    const c = map.get(tid);
    s.o_count = c?.o_count ?? 0;
    s.tri_count = c?.tri_count ?? 0;
    s.x_count = c?.x_count ?? 0;
    s.total_count = c?.total_count ?? 0;
  });

  // 4) 描画
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

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`persons GET failed: ${res.status} ${t}`);
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : [];

  // 既存なら display_name を最新化して返す
  if (data.length > 0) {
    const personId = data[0].id;

    // display_name カラムが存在する前提（なければ追加してね）
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

  if (!insert.ok) {
    const t = await insert.text();
    throw new Error(`persons POST failed: ${insert.status} ${t}`);
  }

  const insertText = await insert.text();
  const created = insertText ? JSON.parse(insertText) : [];
  if (!created[0]) throw new Error("persons POST succeeded but empty response");

  return created[0].id;
}

/* ---------- timeslots (既存RPC) ---------- */

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

/* ---------- counts (新RPC) ---------- */

async function getTimeslotCounts(eventId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_timeslot_counts`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_event_id: eventId }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`get_timeslot_counts failed: ${res.status} ${t}`);
  }

  return await res.json(); // [{timeslot_id,o_count,tri_count,x_count,total_count}, ...]
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
    throw new Error(`saveResponse failed: ${res.status} ${t}`);
  }

  return await res.json();
}

/* ---------- UI ---------- */

function prettyValue(v) {
  if (v === "o") return "○";
  if (v === "tri") return "△";
  if (v === "x") return "×";
  return "-";
}

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

    // 集計表示（timeの下に追加）
    const summary = document.createElement("div");
    summary.className = "muted";
    summary.textContent = `○${s.o_count ?? 0} △${s.tri_count ?? 0} ×${s.x_count ?? 0}`;
    time.appendChild(summary);

    const status = document.createElement("div");
    status.className = "status";
    status.textContent = prettyValue(s.my_value);

    const btns = document.createElement("div");
    btns.className = "btns";

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

        // 1) UIを即反映
        const prev = s.my_value;
        s.my_value = value;

        // 集計も即反映（自分の1票分を調整）
        // prevがあれば減らし、新しいvalueを増やす
        if (prev === "o") s.o_count = Math.max(0, (s.o_count ?? 0) - 1);
        if (prev === "tri") s.tri_count = Math.max(0, (s.tri_count ?? 0) - 1);
        if (prev === "x") s.x_count = Math.max(0, (s.x_count ?? 0) - 1);

        if (value === "o") s.o_count = (s.o_count ?? 0) + 1;
        if (value === "tri") s.tri_count = (s.tri_count ?? 0) + 1;
        if (value === "x") s.x_count = (s.x_count ?? 0) + 1;

        render(slots, eventId, personId);

        // 2) DB保存
        try {
          await saveResponse({ eventId, timeslotId, personId, value });

          // 3) 念のためサーバーの集計で再同期（ズレ防止）
          const counts = await getTimeslotCounts(eventId);
          const map = new Map(counts.map((c) => [c.timeslot_id, c]));
          const c = map.get(timeslotId);
          if (c) {
            s.o_count = c.o_count;
            s.tri_count = c.tri_count;
            s.x_count = c.x_count;
            s.total_count = c.total_count;
            render(slots, eventId, personId);
          }
        } catch (e) {
          console.error(e);
          alert("保存に失敗しました。Consoleを確認してください。");
        }
      });

      return btn;
    };

    // enumに合わせる（重要）
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

