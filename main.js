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

  // ✅ eventId を先に確定
  const urlParams = new URLSearchParams(location.search);
  const eventId = urlParams.get("event");
  if (!eventId) {
    alert("event_id がありません");
    return;
  }

  // ✅ イベント情報を取得して表示
  const event = await getEvent(eventId);

  // ✅ 締切判定（deadline or status）
  const isClosedByDeadline =
    event?.deadline_at ? new Date(event.deadline_at).getTime() <= Date.now() : false;
  const isClosed = event?.status === "closed" || isClosedByDeadline;

  const titleEl = document.getElementById("title");
  if (titleEl) titleEl.textContent = event?.title || "イベント";

  const metaEl = document.getElementById("meta");
  if (metaEl) {
    const deadlineText = event?.deadline_at
      ? new Date(event.deadline_at).toLocaleString()
      : "未設定";
    const closedText = isClosed ? "（締切済み）" : "";
    const statusText = event?.status ? ` / 状態: ${event.status}` : "";
    metaEl.textContent = `締切: ${deadlineText}${closedText}${statusText} / あなた: ${displayName}`;
  }

  // 1) person を取得 or 作成（名前も保存）
  const personId = await getOrCreatePerson(lineUserId, displayName);

  // 2) timeslots を取得（my_value / is_blocked が入っている想定）
  const slots = await getEventTimeslots(eventId, personId);

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

  // 4) 描画（締切フラグも渡す）
  render(slots, eventId, personId, isClosed);
}

/* ---------- events ---------- */

async function getEvent(eventId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/events?select=id,title,deadline_at,status&id=eq.${encodeURIComponent(
      eventId
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
    throw new Error(`events GET failed: ${res.status} ${t}`);
  }

  const data = await res.json();
  return data[0];
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

  if (data.length > 0) {
    const personId = data[0].id;

    // display_name を最新化
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

/* ---------- counts (RPC) ---------- */

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

function render(slots, eventId, personId, isClosed) {
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

    // 集計
    const summary = document.createElement("div");
    summary.className = "muted";
    summary.textContent = `○${s.o_count ?? 0} △${s.tri_count ?? 0} ×${s.x_count ?? 0}`;
    time.appendChild(summary);

    // 自分の状態
    const status = document.createElement("div");
    status.className = "status";
    status.textContent = prettyValue(s.my_value);

    // ボタン
    const btns = document.createElement("div");
    btns.className = "btns";

    const timeslotId = s.timeslot_id ?? s.id;

    const makeBtn = (label, value) => {
      const btn = document.createElement("button");
      btn.textContent = label;

      if ((s.my_value ?? null) === value) btn.classList.add("active");
      if (s.is_blocked || isClosed) btn.disabled = true; // ✅ 締切なら押せない

      btn.addEventListener("click", async () => {
        if (isClosed) return; // ✅ 念のため

        if (!timeslotId) {
          console.warn("timeslotId not found in slot:", s);
          alert("timeslotId が見つかりません");
          return;
        }

        // UIを即反映
        const prev = s.my_value;
        s.my_value = value;

        // 集計の見た目も即反映（自分の1票分だけ調整）
        if (prev === "o") s.o_count = Math.max(0, (s.o_count ?? 0) - 1);
        if (prev === "tri") s.tri_count = Math.max(0, (s.tri_count ?? 0) - 1);
        if (prev === "x") s.x_count = Math.max(0, (s.x_count ?? 0) - 1);

        if (value === "o") s.o_count = (s.o_count ?? 0) + 1;
        if (value === "tri") s.tri_count = (s.tri_count ?? 0) + 1;
        if (value === "x") s.x_count = (s.x_count ?? 0) + 1;

        render(slots, eventId, personId, isClosed);

        // DB保存
        try {
          await saveResponse({ eventId, timeslotId, personId, value });

          // サーバー集計で再同期（ズレ防止）
          const counts = await getTimeslotCounts(eventId);
          const map = new Map(counts.map((c) => [c.timeslot_id, c]));
          const c = map.get(timeslotId);
          if (c) {
            s.o_count = c.o_count;
            s.tri_count = c.tri_count;
            s.x_count = c.x_count;
            s.total_count = c.total_count;
            render(slots, eventId, personId, isClosed);
          }
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

  // 画面下にも締切メッセージ（任意）
  if (isClosed) {
    const note = document.createElement("div");
    note.className = "muted";
    note.style.marginTop = "12px";
    note.textContent = "このイベントは締切済みのため、回答を変更できません。";
    root.appendChild(note);
  }
}

main();
