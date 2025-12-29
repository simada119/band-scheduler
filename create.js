const SUPABASE_URL = "https://prxyvyawahbtczuyskkq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByeHl2eWF3YWhidGN6dXlza2txIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MDE4MzksImV4cCI6MjA3NTQ3NzgzOX0.bu12SWZwAFuGAB_7lDzr1mZDBZ5gwURTP8BccNO68oQ";

// eventsテーブルの network_id（あなたの値に置換）
const NETWORK_ID = "あなたのnetwork_idを貼る";

const slots = [];

function renderSlots() {
  const el = document.getElementById("list");
  if (!el) return;

  if (slots.length === 0) {
    el.textContent = "まだありません";
    return;
  }

  el.innerHTML = slots
    .map((s, i) => {
      const start = new Date(s.start_at).toLocaleString();
      const end = new Date(s.end_at).toLocaleString();
      return `
        <div class="row">
          <div>#${i + 1} ${start} 〜 ${end}</div>
          <button onclick="removeSlot(${i})">削除</button>
        </div>
      `;
    })
    .join("");
}

window.removeSlot = (i) => {
  slots.splice(i, 1);
  renderSlots();
};

document.getElementById("add")?.addEventListener("click", () => {
  const start = document.getElementById("start")?.value;
  const end = document.getElementById("end")?.value;

  if (!start || !end) return alert("start / end を入れてください");

  const s = new Date(start);
  const e = new Date(end);
  if (!(s < e)) return alert("end は start より後にしてください");

  slots.push({
    start_at: s.toISOString(),
    end_at: e.toISOString(),
  });

  document.getElementById("start").value = "";
  document.getElementById("end").value = "";
  renderSlots();
});

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

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${path} insert failed: ${res.status} ${t}`);
  }

  return await res.json();
}

document.getElementById("create")?.addEventListener("click", async () => {
  const title = document.getElementById("title")?.value?.trim();
  const deadline = document.getElementById("deadline")?.value;

  if (!title) return alert("イベント名を入れてください");
  if (!deadline) return alert("締切を入れてください");
  if (slots.length === 0) return alert("候補日時を1つ以上追加してください");

  const resultEl = document.getElementById("result");
  if (resultEl) resultEl.textContent = "作成中...";

  try {
    // 幹事トークン（これがリンクに乗る）
    const adminToken = crypto.randomUUID();

    // 1) events 作成
    const createdEvents = await insert("events?select=id", [
      {
        network_id: NETWORK_ID,
        title,
        deadline_at: new Date(deadline).toISOString(),
        status: "open",
        admin_token: adminToken,
      },
    ]);
    const eventId = createdEvents[0].id;

    // 2) timeslots 作成
    await insert(
      "timeslots",
      slots.map((s) => ({
        event_id: eventId,
        start_at: s.start_at,
        end_at: s.end_at,
      }))
    );

    // 3) 共有リンク生成（create.htmlと同階層想定）
    const base = location.origin + location.pathname.replace(/create\.html$/, "");
    const participantUrl = `${base}?event=${eventId}`;
    const adminUrl = `${base}?event=${eventId}&admin=${adminToken}`;

    if (resultEl) {
      resultEl.innerHTML = `
        <div class="muted">参加者に送るリンク</div>
        <div class="linkbox">${participantUrl}</div>

        <div class="muted" style="margin-top:10px;">幹事用リンク（確定ボタンが出ます）</div>
        <div class="linkbox">${adminUrl}</div>

        <div class="row">
          <button id="copyP">参加者リンクをコピー</button>
          <button id="copyA">幹事リンクをコピー</button>
          <button id="openA">幹事で開く</button>
        </div>
      `;

      document.getElementById("copyP").onclick = async () => {
        await navigator.clipboard.writeText(participantUrl);
        alert("参加者リンクをコピーしました");
      };
      document.getElementById("copyA").onclick = async () => {
        await navigator.clipboard.writeText(adminUrl);
        alert("幹事リンクをコピーしました");
      };
      document.getElementById("openA").onclick = () => {
        location.href = adminUrl;
      };
    }
  } catch (e) {
    console.error(e);
    alert("作成に失敗しました。Consoleを確認してください。");
    if (resultEl) resultEl.textContent = "";
  }
});

renderSlots();


