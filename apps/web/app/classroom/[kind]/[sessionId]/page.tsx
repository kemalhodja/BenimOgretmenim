"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../../../lib/api";
import { clearToken, getToken, isCookieSessionToken } from "../../../lib/auth";
import { loginHrefWithReturn } from "../../../lib/authRedirect";

type RoomResponse = {
  room: {
    kind: "lesson" | "course";
    sessionId: string;
    title: string;
    status: string;
    scheduledStart: string | null;
    scheduledEnd: string | null;
    durationMinutes: number | null;
    meetingUrl: string;
    provider: string;
    canManageRecordings?: boolean;
    teacher: { id: string; displayName: string };
    participants: Array<{ role: string; displayName: string }>;
  };
  notes: Array<{
    id: string;
    body: string | null;
    whiteboard_jsonb: unknown;
    created_at: string;
    author_display_name: string | null;
  }>;
  attendance?: Array<{
    role: string;
    display_name_snapshot: string | null;
    event_type: string;
    created_at: string;
    online: boolean;
  }>;
  whiteboardState?: {
    whiteboard_jsonb: unknown;
    updated_at: string;
    updated_by_display_name?: string | null;
  } | null;
  materials?: Array<{
    id: string;
    title: string;
    material_type: string;
    url: string | null;
    description: string | null;
    created_at: string;
    uploaded_by_display_name: string | null;
  }>;
  recordings?: Array<{
    id: string;
    status: string;
    title: string;
    public_url: string | null;
    duration_seconds: number | null;
    created_at: string;
    created_by_display_name: string | null;
  }>;
  messages?: ClassroomMessage[];
};

type ClassroomMessage = {
  id: string;
  author_role: string | null;
  author_display_name: string | null;
  message_type: "chat" | "question" | "answer" | "announcement";
  body: string;
  created_at: string;
};

type Point = { x: number; y: number };
type Stroke = { color: string; width: number; points: Point[] };

const colors = ["#111827", "#dc2626", "#2563eb", "#16a34a"] as const;

function toLocal(value: string | null): string {
  if (!value) return "Planlanmadı";
  return new Date(value).toLocaleString("tr-TR");
}

function roomStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    scheduled: "Planlandı",
    live: "Canlı",
    completed: "Tamamlandı",
    cancelled: "İptal edildi",
    no_show: "Katılım olmadı",
  };
  return labels[status] ?? "Durum güncelleniyor";
}

function recordingStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    processing: "Hazırlanıyor",
    ready: "İzlemeye hazır",
    failed: "Hazırlanamadı",
    hidden: "Gizli",
  };
  return labels[status] ?? "Durum güncelleniyor";
}

function whiteboardImage(note: RoomResponse["notes"][number]): string | null {
  const value = note.whiteboard_jsonb;
  if (!value || typeof value !== "object") return null;
  const image = (value as { imageDataUrl?: unknown }).imageDataUrl;
  return typeof image === "string" ? image : null;
}

export default function ClassroomPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const params = useParams<{ kind: string; sessionId: string }>();
  const kind = params.kind;
  const sessionId = params.sessionId;
  const endpointKind = kind === "course" ? "course-sessions" : "lesson-sessions";

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const appliedWhiteboardRef = useRef<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<RoomResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [whiteboardStatus, setWhiteboardStatus] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [materialBusy, setMaterialBusy] = useState(false);
  const [materialTitle, setMaterialTitle] = useState("");
  const [materialUrl, setMaterialUrl] = useState("");
  const [materialDescription, setMaterialDescription] = useState("");
  const [recordingBusy, setRecordingBusy] = useState(false);
  const [recordingTitle, setRecordingTitle] = useState("");
  const [recordingUrl, setRecordingUrl] = useState("");
  const [recordingDuration, setRecordingDuration] = useState("");
  const [messageText, setMessageText] = useState("");
  const [messageType, setMessageType] = useState<ClassroomMessage["message_type"]>("chat");
  const [messageBusy, setMessageBusy] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<"connecting" | "live" | "retrying" | "off">("off");
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [color, setColor] = useState<(typeof colors)[number]>("#111827");
  const [width, setWidth] = useState(3);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace(loginHrefWithReturn(pathname));
      return;
    }
    setToken(t);
  }, [router, pathname]);

  const load = useCallback(async () => {
    if (!token || !sessionId) return;
    setError(null);
    const r = await apiFetch<RoomResponse>(`/v1/classroom/${endpointKind}/${sessionId}`, { token });
    setData(r);
  }, [token, endpointKind, sessionId]);

  useEffect(() => {
    load().catch((e) => {
      const msg = e instanceof Error ? e.message : "classroom_load_failed";
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
        return;
      }
      if (msg.includes("[403]") || msg.includes("[404]")) {
        setError("Bu sınıfa erişim izniniz yok veya oturum bulunamadı.");
        return;
      }
      setError(msg);
    });
  }, [load, router, pathname]);

  const loadMessages = useCallback(async () => {
    if (!token || !sessionId) return;
    const r = await apiFetch<{ messages: ClassroomMessage[] }>(
      `/v1/classroom/${endpointKind}/${sessionId}/messages`,
      { token },
    );
    setData((prev) => (prev ? { ...prev, messages: r.messages } : prev));
  }, [token, endpointKind, sessionId]);

  const applySharedWhiteboard = useCallback((state: RoomResponse["whiteboardState"] | undefined | null) => {
    if (!state || !state.whiteboard_jsonb || typeof state.whiteboard_jsonb !== "object") return;
    const next = (state.whiteboard_jsonb as { strokes?: unknown }).strokes;
    if (!Array.isArray(next)) return;
    setStrokes(next as Stroke[]);
    appliedWhiteboardRef.current = state.updated_at;
    setWhiteboardStatus(`Tahta alındı: ${new Date(state.updated_at).toLocaleTimeString("tr-TR")}`);
  }, []);

  useEffect(() => {
    if (!token || !sessionId) return;
    setRealtimeStatus("connecting");
    const eventsUrl = isCookieSessionToken(token)
      ? `/v1/classroom/${endpointKind}/${sessionId}/events`
      : `/v1/classroom/${endpointKind}/${sessionId}/events?token=${encodeURIComponent(token)}`;
    const source = new EventSource(eventsUrl);
    source.addEventListener("ready", () => {
      setRealtimeStatus("live");
    });
    source.addEventListener("snapshot", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent<string>).data) as Pick<
          RoomResponse,
          "attendance" | "messages" | "whiteboardState"
        >;
        setData((prev) =>
          prev
            ? {
                ...prev,
                attendance: payload.attendance ?? prev.attendance,
                messages: payload.messages ?? prev.messages,
                whiteboardState: payload.whiteboardState ?? prev.whiteboardState,
              }
            : prev,
        );
        if (!drawingRef.current && payload.whiteboardState?.updated_at !== appliedWhiteboardRef.current) {
          applySharedWhiteboard(payload.whiteboardState);
        }
        setRealtimeStatus("live");
      } catch {
        setRealtimeStatus("retrying");
      }
    });
    source.onerror = () => {
      setRealtimeStatus("retrying");
    };
    return () => {
      source.close();
      setRealtimeStatus("off");
    };
  }, [token, sessionId, endpointKind, applySharedWhiteboard]);

  const sendAttendance = useCallback(
    async (eventType: "join" | "leave" | "heartbeat") => {
      if (!token || !sessionId) return;
      const r = await apiFetch<{ attendance: NonNullable<RoomResponse["attendance"]> }>(
        `/v1/classroom/${endpointKind}/${sessionId}/attendance`,
        {
          method: "POST",
          token,
          body: JSON.stringify({
            eventType,
            clientMeta: {
              path: pathname,
              userAgent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 180) : "",
            },
          }),
        },
      );
      setData((prev) => (prev ? { ...prev, attendance: r.attendance } : prev));
    },
    [token, sessionId, endpointKind, pathname],
  );

  useEffect(() => {
    if (!token || !sessionId) return;
    void sendAttendance("join").catch(() => {});
    const id = window.setInterval(() => {
      void sendAttendance("heartbeat").catch(() => {});
    }, 45_000);
    const onHide = () => {
      if (document.visibilityState === "hidden") void sendAttendance("leave").catch(() => {});
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onHide);
      void sendAttendance("leave").catch(() => {});
    };
  }, [token, sessionId, sendAttendance]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (const p of stroke.points.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
  }, [strokes]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  useEffect(() => {
    if (strokes.length > 0) return;
    const updatedAt = data?.whiteboardState?.updated_at ?? null;
    if (!updatedAt || appliedWhiteboardRef.current === updatedAt) return;
    applySharedWhiteboard(data?.whiteboardState);
  }, [data?.whiteboardState, strokes.length, applySharedWhiteboard]);

  function pointFromEvent(e: PointerEvent<HTMLCanvasElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * e.currentTarget.width,
      y: ((e.clientY - rect.top) / rect.height) * e.currentTarget.height,
    };
  }

  function startDraw(e: PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const point = pointFromEvent(e);
    setStrokes((prev) => [...prev, { color, width, points: [point] }]);
  }

  function moveDraw(e: PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const point = pointFromEvent(e);
    setStrokes((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (!last) return prev;
      next[next.length - 1] = { ...last, points: [...last.points, point] };
      return next;
    });
  }

  function endDraw() {
    drawingRef.current = false;
  }

  async function saveNote(includeWhiteboard: boolean) {
    if (!token || !sessionId) return;
    const body = note.trim();
    const canvas = canvasRef.current;
    const whiteboard =
      includeWhiteboard && canvas
        ? {
            imageDataUrl: canvas.toDataURL("image/png"),
            strokes,
            exportedAt: new Date().toISOString(),
          }
        : undefined;
    if (!body && !whiteboard) {
      setError("Not veya tahta içeriği ekleyin.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/v1/classroom/${endpointKind}/${sessionId}/notes`, {
        method: "POST",
        token,
        body: JSON.stringify({ body: body || null, whiteboard }),
      });
      setNote("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "note_save_failed");
    } finally {
      setBusy(false);
    }
  }

  async function shareWhiteboard() {
    if (!token || !sessionId) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBusy(true);
    setError(null);
    setWhiteboardStatus(null);
    try {
      const r = await apiFetch<{ whiteboardState: RoomResponse["whiteboardState"] }>(
        `/v1/classroom/${endpointKind}/${sessionId}/whiteboard`,
        {
          method: "POST",
          token,
          body: JSON.stringify({
            whiteboard: {
              imageDataUrl: canvas.toDataURL("image/png"),
              strokes,
              updatedAtClient: new Date().toISOString(),
            },
          }),
        },
      );
      setData((prev) => (prev ? { ...prev, whiteboardState: r.whiteboardState } : prev));
      setWhiteboardStatus("Tahta sınıfla paylaşıldı.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "whiteboard_share_failed");
    } finally {
      setBusy(false);
    }
  }

  async function addMaterial() {
    if (!token || !sessionId) return;
    const title = materialTitle.trim();
    if (title.length < 2) {
      setError("Materyal başlığı en az 2 karakter olmalı.");
      return;
    }
    setMaterialBusy(true);
    setError(null);
    try {
      await apiFetch(`/v1/classroom/${endpointKind}/${sessionId}/materials`, {
        method: "POST",
        token,
        body: JSON.stringify({
          title,
          materialType: materialUrl.trim() ? "link" : "note",
          url: materialUrl.trim() || null,
          description: materialDescription.trim() || null,
        }),
      });
      setMaterialTitle("");
      setMaterialUrl("");
      setMaterialDescription("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "material_save_failed");
    } finally {
      setMaterialBusy(false);
    }
  }

  async function addRecording() {
    if (!token || !sessionId) return;
    const title = recordingTitle.trim();
    const url = recordingUrl.trim();
    if (title.length < 2 || !url) {
      setError("Kayıt başlığı ve izleme linki zorunlu.");
      return;
    }
    const durationMinutes = recordingDuration.trim() ? Number(recordingDuration) : null;
    const durationSeconds =
      typeof durationMinutes === "number" && Number.isFinite(durationMinutes)
        ? Math.max(0, Math.round(durationMinutes * 60))
        : null;
    setRecordingBusy(true);
    setError(null);
    try {
      await apiFetch(`/v1/classroom/${endpointKind}/${sessionId}/recordings`, {
        method: "POST",
        token,
        body: JSON.stringify({
          title,
          url,
          status: "ready",
          durationSeconds,
          consentSnapshot: {
            source: "manual_classroom_replay_link",
            capturedAt: new Date().toISOString(),
          },
        }),
      });
      setRecordingTitle("");
      setRecordingUrl("");
      setRecordingDuration("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "recording_save_failed");
    } finally {
      setRecordingBusy(false);
    }
  }

  async function sendMessage() {
    if (!token || !sessionId) return;
    const body = messageText.trim();
    if (!body) {
      setError("Mesaj boş olamaz.");
      return;
    }
    setMessageBusy(true);
    setError(null);
    try {
      const r = await apiFetch<{ message: ClassroomMessage }>(
        `/v1/classroom/${endpointKind}/${sessionId}/messages`,
        {
          method: "POST",
          token,
          body: JSON.stringify({ body, messageType }),
        },
      );
      setMessageText("");
      setData((prev) =>
        prev ? { ...prev, messages: [...(prev.messages ?? []), r.message].slice(-80) } : prev,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "message_send_failed");
    } finally {
      setMessageBusy(false);
    }
  }

  const room = data?.room;
  const notes = data?.notes ?? [];
  const attendance = data?.attendance ?? [];
  const materials = data?.materials ?? [];
  const recordings = data?.recordings ?? [];
  const messages = data?.messages ?? [];
  const meetingSrc = useMemo(() => room?.meetingUrl ?? "about:blank", [room?.meetingUrl]);

  if (!token) return null;

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Link href={kind === "course" ? "/student/kurslar" : "/student/dersler"} className="text-sm font-medium text-brand-800 underline">
          Panele dön
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-paper-900">
              {room?.title ?? "Canlı sınıf"}
            </h1>
            <p className="mt-1 text-sm text-paper-800/70">
              {room ? `${roomStatusLabel(room.status)} · ${toLocal(room.scheduledStart)} · ${room.durationMinutes ?? "—"} dk` : "Yükleniyor"}
            </p>
            <p className="mt-1 text-xs text-paper-800/55">
              Gerçek zamanlı:{" "}
              <span className={realtimeStatus === "live" ? "font-medium text-brand-800" : "font-medium text-amber-800"}>
                {realtimeStatus === "live"
                  ? "bağlı"
                  : realtimeStatus === "connecting"
                    ? "bağlanıyor"
                    : realtimeStatus === "retrying"
                      ? "yeniden deneniyor"
                      : "kapalı"}
              </span>
            </p>
          </div>
          {room?.meetingUrl ? (
            <a
              href={room.meetingUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-paper-200 bg-white px-3 py-2 text-sm font-medium text-paper-900 hover:bg-paper-100"
            >
              Görüşmeyi yeni sekmede aç
            </a>
          ) : null}
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        ) : null}

        <section className="mt-4 rounded-2xl border border-brand-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-800/70">
                Canlı ders kalite döngüsü
              </div>
              <h2 className="mt-1 text-base font-semibold text-paper-900">Ders öncesi, ders içi ve ders sonrası kontrol</h2>
            </div>
            <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-900">
              {room?.status ?? "hazırlanıyor"}
            </span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            {[
              ["Bağlantı", realtimeStatus === "live" ? "Canlı" : "Kontrol et"],
              ["Materyal", materials.length ? `${materials.length} materyal` : "Ekle / iste"],
              ["Tahta/not", notes.length ? `${notes.length} kayıt` : "Ders notu bekliyor"],
              ["Tekrar/özet", recordings.length ? `${recordings.length} kayıt` : "Ders sonrası ekle"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-paper-200 bg-paper-50 p-3">
                <div className="text-xs text-paper-800/55">{label}</div>
                <div className="mt-1 text-sm font-semibold text-paper-950">{value}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-paper-800/60">
            Ders bitince öğretmen notu, konu etiketi, ödev ve sonraki adım teacher dersler ekranındaki mini değerlendirmeyle öğrenci/veli paneline düşer.
          </p>
        </section>

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="overflow-hidden rounded-2xl border border-paper-200 bg-black">
            {room ? (
              <iframe
                src={meetingSrc}
                title="Canlı ders görüşmesi"
                allow="camera; microphone; fullscreen; display-capture; autoplay"
                className="h-[62vh] min-h-[420px] w-full"
              />
            ) : (
              <div className="flex h-[420px] items-center justify-center text-sm text-white/70">Sınıf açılıyor…</div>
            )}
          </section>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-paper-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-paper-900">Katılımcılar</h2>
              <ul className="mt-3 space-y-2 text-sm text-paper-800">
                {(room?.participants ?? []).map((p, i) => (
                  <li key={`${p.role}-${p.displayName}-${i}`} className="flex justify-between gap-2">
                    <span>{p.displayName}</span>
                    <span className="text-xs text-paper-800/55">{p.role}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl border border-paper-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-paper-900">Yoklama</h2>
              <p className="mt-1 text-xs text-paper-800/55">
                Son 90 saniyede heartbeat atanlar çevrimiçi görünür.
              </p>
              <ul className="mt-3 space-y-2 text-sm text-paper-800">
                {attendance.length === 0 ? (
                  <li className="text-paper-800/55">Henüz katılım kaydı yok.</li>
                ) : (
                  attendance.map((a, i) => (
                    <li
                      key={`${a.display_name_snapshot}-${a.created_at}-${i}`}
                      className="flex items-center justify-between gap-2"
                    >
                      <span>{a.display_name_snapshot ?? "Kullanıcı"}</span>
                      <span className={a.online ? "text-xs font-medium text-brand-800" : "text-xs text-paper-800/45"}>
                        {a.online ? "çevrimiçi" : a.event_type}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </section>

            <section className="rounded-2xl border border-paper-200 bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-paper-900">Sohbet ve sorular</h2>
                <button
                  type="button"
                  onClick={() => void loadMessages()}
                  className="text-xs font-medium text-brand-800 underline"
                >
                  Yenile
                </button>
              </div>
              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1 text-sm">
                {messages.length === 0 ? (
                  <p className="text-paper-800/55">Henüz mesaj yok.</p>
                ) : (
                  messages.map((m) => (
                    <article
                      key={m.id}
                      className={`rounded-lg p-2 ${
                        m.message_type === "announcement"
                          ? "border border-brand-200 bg-brand-50"
                          : m.message_type === "question"
                            ? "border border-amber-200 bg-amber-50"
                            : "bg-paper-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px] text-paper-800/55">
                        <span>
                          {m.author_display_name ?? "Kullanıcı"} · {m.author_role ?? "user"}
                        </span>
                        <span>{new Date(m.created_at).toLocaleTimeString("tr-TR")}</span>
                      </div>
                      <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-paper-800/55">
                        {m.message_type}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-paper-900">{m.body}</p>
                    </article>
                  ))
                )}
              </div>
              <div className="mt-3 space-y-2">
                <select
                  value={messageType}
                  onChange={(e) => setMessageType(e.target.value as ClassroomMessage["message_type"])}
                  className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm"
                >
                  <option value="chat">Sohbet</option>
                  <option value="question">Soru</option>
                  <option value="answer">Cevap</option>
                  {room?.canManageRecordings ? <option value="announcement">Duyuru</option> : null}
                </select>
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  rows={3}
                  maxLength={1200}
                  className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm"
                  placeholder="Mesaj veya soru yaz..."
                />
                <button
                  type="button"
                  disabled={messageBusy}
                  onClick={() => void sendMessage()}
                  className="rounded-lg bg-brand-800 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  {messageBusy ? "…" : "Gönder"}
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-paper-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-paper-900">Ders notu</h2>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                className="mt-3 w-full rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                placeholder="Ders içi not, ödev veya hatırlatma..."
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveNote(false)}
                  className="rounded-lg bg-brand-800 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  Notu kaydet
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveNote(true)}
                  className="rounded-lg border border-paper-300 bg-white px-3 py-1.5 text-xs font-medium text-paper-900 disabled:opacity-50"
                >
                  Not + tahtayı kaydet
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-paper-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-paper-900">Materyaller</h2>
              <div className="mt-3 space-y-2">
                <input
                  value={materialTitle}
                  onChange={(e) => setMaterialTitle(e.target.value)}
                  className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm"
                  placeholder="Başlık"
                />
                <input
                  value={materialUrl}
                  onChange={(e) => setMaterialUrl(e.target.value)}
                  className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm"
                  placeholder="https://... (isteğe bağlı)"
                />
                <textarea
                  value={materialDescription}
                  onChange={(e) => setMaterialDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm"
                  placeholder="Kısa açıklama"
                />
                <button
                  type="button"
                  disabled={materialBusy}
                  onClick={() => void addMaterial()}
                  className="rounded-lg border border-paper-300 bg-white px-3 py-1.5 text-xs font-medium text-paper-900 disabled:opacity-50"
                >
                  {materialBusy ? "…" : "Materyal ekle"}
                </button>
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                {materials.length === 0 ? (
                  <li className="text-paper-800/55">Materyal yok.</li>
                ) : (
                  materials.map((m) => (
                    <li key={m.id} className="rounded-lg bg-paper-50 p-2">
                      <div className="font-medium text-paper-900">{m.title}</div>
                      <div className="text-xs text-paper-800/55">
                        {m.material_type} · {new Date(m.created_at).toLocaleString("tr-TR")}
                      </div>
                      {m.url ? (
                        <a href={m.url} target="_blank" rel="noreferrer" className="text-xs text-brand-800 underline">
                          Aç
                        </a>
                      ) : null}
                      {m.description ? <p className="mt-1 text-xs text-paper-800/70">{m.description}</p> : null}
                    </li>
                  ))
                )}
              </ul>
            </section>

            <section className="rounded-2xl border border-paper-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-paper-900">Tekrar izle</h2>
              {room?.canManageRecordings ? (
                <div className="mt-3 space-y-2">
                  <input
                    value={recordingTitle}
                    onChange={(e) => setRecordingTitle(e.target.value)}
                    className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm"
                    placeholder="Kayıt başlığı"
                  />
                  <input
                    value={recordingUrl}
                    onChange={(e) => setRecordingUrl(e.target.value)}
                    className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm"
                    placeholder="Kayıt / replay linki"
                  />
                  <input
                    value={recordingDuration}
                    onChange={(e) => setRecordingDuration(e.target.value)}
                    className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm"
                    placeholder="Süre, dakika (isteğe bağlı)"
                    inputMode="decimal"
                  />
                  <button
                    type="button"
                    disabled={recordingBusy}
                    onClick={() => void addRecording()}
                    className="rounded-lg border border-paper-300 bg-white px-3 py-1.5 text-xs font-medium text-paper-900 disabled:opacity-50"
                  >
                    {recordingBusy ? "…" : "Kayıt linki ekle"}
                  </button>
                </div>
              ) : null}
              <ul className="mt-4 space-y-2 text-sm">
                {recordings.length === 0 ? (
                  <li className="text-paper-800/55">Henüz tekrar izleme kaydı yok.</li>
                ) : (
                  recordings.map((r) => (
                    <li key={r.id} className="rounded-lg bg-paper-50 p-2">
                      <div className="font-medium text-paper-900">{r.title}</div>
                      <div className="text-xs text-paper-800/55">
                        {recordingStatusLabel(r.status)} · {new Date(r.created_at).toLocaleString("tr-TR")}
                        {r.duration_seconds ? ` · ${Math.round(r.duration_seconds / 60)} dk` : ""}
                      </div>
                      {r.public_url ? (
                        <a
                          href={r.public_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-brand-800 underline"
                        >
                          Kaydı aç
                        </a>
                      ) : null}
                    </li>
                  ))
                )}
              </ul>
            </section>
          </aside>
        </div>

        <section className="mt-6 rounded-2xl border border-paper-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-paper-900">Dijital tahta</h2>
              <p className="mt-1 text-xs text-paper-800/55">
                Kalemle çiz, gerekirse dersi bitirirken notlarla birlikte kaydet.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full border ${color === c ? "border-paper-900" : "border-paper-200"}`}
                  style={{ backgroundColor: c }}
                  aria-label={`Renk ${c}`}
                />
              ))}
              <select
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                className="rounded-lg border border-paper-200 px-2 py-1 text-xs"
              >
                <option value={2}>İnce</option>
                <option value={4}>Orta</option>
                <option value={8}>Kalın</option>
              </select>
              <button
                type="button"
                onClick={() => setStrokes((prev) => prev.slice(0, -1))}
                className="rounded-lg border border-paper-200 px-2 py-1 text-xs"
              >
                Geri al
              </button>
              <button
                type="button"
                onClick={() => setStrokes([])}
                className="rounded-lg border border-paper-200 px-2 py-1 text-xs"
              >
                Temizle
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => applySharedWhiteboard(data?.whiteboardState)}
                className="rounded-lg border border-paper-200 px-2 py-1 text-xs disabled:opacity-50"
              >
                Güncel tahtayı al
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void shareWhiteboard()}
                className="rounded-lg bg-brand-800 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
              >
                Tahtayı paylaş
              </button>
            </div>
          </div>
          {whiteboardStatus || data?.whiteboardState?.updated_at ? (
            <p className="mt-3 text-xs text-paper-800/55">
              {whiteboardStatus ??
                `Son paylaşılan tahta: ${new Date(data!.whiteboardState!.updated_at).toLocaleString("tr-TR")}`}
            </p>
          ) : null}
          <canvas
            ref={canvasRef}
            width={1280}
            height={720}
            onPointerDown={startDraw}
            onPointerMove={moveDraw}
            onPointerUp={endDraw}
            onPointerCancel={endDraw}
            className="mt-4 aspect-video w-full touch-none rounded-xl border border-paper-200 bg-white"
          />
        </section>

        <section className="mt-6 rounded-2xl border border-paper-200 bg-white p-4">
          <h2 className="text-base font-semibold text-paper-900">Kayıtlı notlar ve tahta çıktıları</h2>
          <div className="mt-3 space-y-3">
            {notes.length === 0 ? (
              <p className="text-sm text-paper-800/55">Henüz kayıt yok.</p>
            ) : (
              notes.map((n) => {
                const image = whiteboardImage(n);
                return (
                  <article key={n.id} className="rounded-xl border border-paper-100 bg-paper-50 p-3 text-sm">
                    <div className="text-xs text-paper-800/55">
                      {n.author_display_name ?? "Kullanıcı"} · {new Date(n.created_at).toLocaleString("tr-TR")}
                    </div>
                    {n.body ? <p className="mt-2 whitespace-pre-wrap text-paper-900">{n.body}</p> : null}
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image} alt="Kaydedilen tahta" className="mt-3 rounded-lg border border-paper-200 bg-white" />
                    ) : null}
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
