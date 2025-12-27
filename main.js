const SUPABASE_URL = "https://xxxxx.supabase.co";
const SUPABASE_ANON_KEY = "public-anon-key";

async function main() {
  await liff.init({ liffId: "YOUR_LIFF_ID" });

  const urlParams = new URLSearchParams(location.search);
  const eventId = urlParams.get("event");

  if (!eventId) {
    alert("event_id がありません");
    return;
  }

  const profile = await liff.getProfile();
  const lineUserId = profile.userId;

  // 1) person を取得 or 作成
  const personId = await getOrCreatePerson(lineUserId);

  // 2) timeslots を取得
  const slots = await getEventTimeslots(eventId, personId);

  render(slots);
}

async function getOrCreatePerson(lineUserId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/persons?line_user_id=eq.${lineUserId}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  const data = await res.json();
  if (data.length > 0) return data[0].id;

  const insert = await fetch(`${SUPABASE_URL}/rest/v1/persons`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ line_user_id: lineUserId }),
  });
  const created = await insert.json();
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
  return await res.json();
}

function render(slots) {
  const root = document.getElementById("slots");
  root.innerHTML = "";

  slots.forEach(s => {
    const div = document.createElement("div");
    div.className = "slot" + (s.is_blocked ? " blocked" : "");
    div.innerHTML = `
      <div>${new Date(s.start_at).toLocaleString()} 〜 ${new Date(s.end_at).toLocaleString()}</div>
      <div>状態: ${s.is_blocked ? "× 確定済みと重複" : s.my_value ?? "-"}</div>
    `;
    root.appendChild(div);
  });
}

main();
