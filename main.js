const SUPABASE_URL = "https://prxyvyawahbtczuyskkq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByeHl2eWF3YWhidGN6dXlza2txIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MDE4MzksImV4cCI6MjA3NTQ3NzgzOX0.bu12SWZwAFuGAB_7lDzr1mZDBZ5gwURTP8BccNO68oQ";

async function main() {
 await liff.init({ liffId: "2008788331-Py2gq4G8" });
 if (!liff.isLoggedIn()) {
  // 外部ブラウザで開いた場合は、ここでLINEログインに飛ばす必要がある
  liff.login({ redirectUri: location.href });
  return;
}

// ここから下で getProfile() などを呼ぶ
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
  // 1) まず検索（idだけ取る）
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/persons?select=id&line_user_id=eq.${encodeURIComponent(lineUserId)}`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${S


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







