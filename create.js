const SUPABASE_URL = "https://prxyvyawahbtczuyskkq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByeHl2eWF3YWhidGN6dXlza2txIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MDE4MzksImV4cCI6MjA3NTQ3NzgzOX0.bu12SWZwAFuGAB_7lDzr1mZDBZ5gwURTP8BccNO68oQ";

// eventsテーブルに入ってる network_id（スクショに写ってるやつ）
const NETWORK_ID = "56570d2e-0b11-4870-b3e0-5236c128cc5d";

const slots = [];

function renderSlots() {
  const el = document.getElementById("list");
  if (slots.length === 0) {
    el.textContent = "まだありません";
    return;
  }

  el.innerHTML = slots
    .map(
      (s, i) => `
      <div class="row">
        <div>#${i + 1} ${new Date(s.start_at).toLocaleString()} 〜 ${new Date(
        s.end_at
      ).toLocaleString()}</div>
        <button onclick="removeSlot(${i})">削除</button>
      </div>
    `
    )
    .join("");
}

window.removeSlot = (i) => {
  slots.splice(i, 1);
  renderSlots();
};

document.getElementById("add").onclick = () => {
  const start = document.getElementById("start").value;
  const end = document.getElementById("end").value;

  if (!start || !end) return alert("start / end を入れてください");

  const s = new Date(start);
  const e = new Date(end);
  if (s >= e) return alert("end は start より後にしてください");

  slots.push({ start_at: s.toISOString(), end_at: e.toISOString() });

  document.getElementById("start").value = "";
  document.getElementById("end").value = "";
  renderSlots();
};

async function insert(path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

document.getElementById("create").onclick = async () => {
  const title = document.getElementById("title").value.trim();
  const deadline = document.getElementById("deadline").value;

  if (!title) return alert("イベント名を入れてください");
  if (!deadline) return alert("締切を入れてください");
  if (slots.length === 0) return alert("時間帯を1つ以上入れてください");

  const resultEl = document.getElementById("result");
  resultEl.textContent = "作成中...";

  try {
    // 1) events作成
    const createdEvents = await insert("events?select=id", [
      {
        network_id: NETWORK_ID,
        title,
        deadline_at: new Date(deadline).toISOString(),
        status: "open",
      },
    ]);
    const eventId = createdEvents[0].id;

    // 2) timeslots作成
    await insert(
      "timeslots",
      slots.map((s) => ({
        event_id: eventId,
        start_at: s.start_at,
        end_at: s.end_at,
      }))
    );

    // 3) 共有リンク
    const shareUrl = `${location.origin}/?event=${eventId}`;

    resultEl.innerHTML = `
      <div class="muted">参加者に送るリンク</div>
      <div class="linkbox">${shareUrl}</div>
      <div class="row">
        <button id="copy">コピー</button>
        <button id="open">開く</button>
      </div>
    `;

    document.getElementById("copy").onclick = async () => {
      await navigator.clipboard.writeText(shareUrl);
      alert("コピーしました");
    };
    document.getElementById("open").onclick = () => {
      location.href = shareUrl;
    };
  } catch (e) {
    console.error(e);
    alert("作成に失敗しました。Consoleを確認してください。");
    resultEl.textContent = "";
  }
};

renderSlots();

