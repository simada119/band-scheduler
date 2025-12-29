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

  render(slots);
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






