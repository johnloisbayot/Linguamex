import { useState, useRef, useEffect } from "react";
import {
  BookOpen, Play, GraduationCap, BarChart3, Upload, X, Plus,
  ChevronLeft, ChevronRight, Send, Loader2, Check, FileText, Film
} from "lucide-react";

// ─── Gemini API ───────────────────────────────────────────────────────────────
async function callClaude(messages, system = "") {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: system ? { parts: [{ text: system }] } : undefined,
        contents: messages.map((m) => ({
          role: m.role === "user" ? "user" : "model",
          parts: [{ text: m.content || m.text || "" }],
        })),
        generationConfig: { maxOutputTokens: 1000 },
      }),
    }
  );
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// ─── PDF.js loader ────────────────────────────────────────────────────────────
function loadPDFJS() {
  return new Promise((resolve) => {
    if (window.pdfjsLib) return resolve();
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      resolve();
    };
    document.head.appendChild(s);
  });
}

async function extractPDFText(file) {
  await loadPDFJS();
  const buf = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const pg = await pdf.getPage(i);
    const tc = await pg.getTextContent();
    text += tc.items.map((it) => it.str).join(" ") + "\n\n";
  }
  return text;
}

// ─── SRT Parser ───────────────────────────────────────────────────────────────
function parseSRT(raw) {
  const toSec = (t) => {
    const [h, m, s] = t.replace(",", ".").split(":");
    return +h * 3600 + +m * 60 + +s;
  };
  return raw
    .trim()
    .split(/\n\s*\n/)
    .map((block) => {
      const lines = block.trim().split("\n");
      if (lines.length < 3) return null;
      const m = lines[1].match(
        /(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})/
      );
      if (!m) return null;
      return {
        start: toSec(m[1]),
        end: toSec(m[2]),
        text: lines
          .slice(2)
          .join(" ")
          .replace(/<[^>]+>/g, "")
          .trim(),
      };
    })
    .filter(Boolean);
}

// ─── Clickable Text ───────────────────────────────────────────────────────────
function ClickableText({ text, onWordTap, fontSize = 17, lineHeight = 1.95 }) {
  return (
    <p style={{ margin: 0, fontSize, lineHeight, fontFamily: "'Crimson Pro', serif", color: "#e8d5b0" }}>
      {text.split(/(\s+)/).map((chunk, i) => {
        if (/^\s+$/.test(chunk)) return chunk;
        const clean = chunk.replace(/^[¿¡«"]+|[.,;:!?»""\]\)]+$/g, "");
        if (!clean) return <span key={i}>{chunk}</span>;
        return (
          <span
            key={i}
            onClick={() => onWordTap(clean, text)}
            className="tappable-word"
          >
            {chunk}
          </span>
        );
      })}
    </p>
  );
}

// ─── Reader Tab ───────────────────────────────────────────────────────────────
function ReaderTab({ onWordTap }) {
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const fileRef = useRef();
  const WORDS_PER_PAGE = 280;

  const handleFile = async (file) => {
    setLoading(true);
    setFileName(file.name);
    setPage(0);
    try {
      if (file.name.toLowerCase().endsWith(".txt")) {
        setContent(await file.text());
      } else if (file.name.toLowerCase().endsWith(".pdf")) {
        setContent(await extractPDFText(file));
      } else {
        setContent("Unsupported format. Please use .txt or .pdf");
      }
    } catch {
      setContent("Error reading file. Please try again.");
    }
    setLoading(false);
  };

  const words = content.split(/\s+/).filter(Boolean);
  const totalPages = Math.max(1, Math.ceil(words.length / WORDS_PER_PAGE));
  const pageText = words
    .slice(page * WORDS_PER_PAGE, (page + 1) * WORDS_PER_PAGE)
    .join(" ");

  return (
    <div className="tab-container">
      <input
        ref={fileRef}
        type="file"
        accept=".txt,.pdf"
        style={{ display: "none" }}
        onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
      />

      {!content && !loading ? (
        <div className="empty-state">
          <div className="empty-icon">
            <BookOpen size={34} color="#e8a020" />
          </div>
          <div style={{ textAlign: "center" }}>
            <div className="empty-title">E-Reader</div>
            <div className="empty-desc">
              Upload a .txt or .pdf in Mexican Spanish.
              <br />
              Tap any word for instant translation.
            </div>
          </div>
          <button className="btn-primary" onClick={() => fileRef.current.click()}>
            <Upload size={17} /> Upload Book
          </button>
        </div>
      ) : (
        <>
          <div className="file-header">
            <FileText size={13} color="#e8a020" />
            <span className="file-name">{fileName}</span>
            <span className="page-count">
              {page + 1} / {totalPages}
            </span>
            <button
              className="icon-btn"
              onClick={() => {
                setContent("");
                setFileName("");
              }}
            >
              <X size={15} />
            </button>
          </div>

          <div className="reader-body">
            {loading ? (
              <div className="loading-row">
                <Loader2 size={16} className="spin" />
                Loading file…
              </div>
            ) : (
              <ClickableText text={pageText} onWordTap={onWordTap} />
            )}
          </div>

          <div className="pagination">
            <button
              className={`page-btn ${page === 0 ? "disabled" : ""}`}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft size={15} /> Prev
            </button>
            <button
              className="new-file-btn"
              onClick={() => fileRef.current.click()}
            >
              <Upload size={12} /> New file
            </button>
            <button
              className={`page-btn ${page === totalPages - 1 ? "disabled" : ""}`}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
            >
              Next <ChevronRight size={15} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Media Tab ────────────────────────────────────────────────────────────────
function MediaTab({ onWordTap }) {
  const [videoSrc, setVideoSrc] = useState("");
  const [subtitles, setSubtitles] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoName, setVideoName] = useState("");
  const videoRef = useRef();
  const videoFileRef = useRef();
  const srtFileRef = useRef();

  const handleVideo = (file) => {
    setVideoName(file.name);
    setVideoSrc(URL.createObjectURL(file));
  };

  const handleSRT = async (file) => {
    const text = await file.text();
    setSubtitles(parseSRT(text));
  };

  const currentSub = subtitles.find(
    (s) => currentTime >= s.start && currentTime <= s.end
  );

  return (
    <div className="tab-container">
      <input
        ref={videoFileRef}
        type="file"
        accept="video/*,audio/*"
        style={{ display: "none" }}
        onChange={(e) => e.target.files[0] && handleVideo(e.target.files[0])}
      />
      <input
        ref={srtFileRef}
        type="file"
        accept=".srt,.vtt"
        style={{ display: "none" }}
        onChange={(e) => e.target.files[0] && handleSRT(e.target.files[0])}
      />

      {!videoSrc ? (
        <div className="empty-state">
          <div className="empty-icon">
            <Film size={34} color="#e8a020" />
          </div>
          <div style={{ textAlign: "center" }}>
            <div className="empty-title">Media Player</div>
            <div className="empty-desc">
              Play local video, audio, movies or podcasts.
              <br />
              Load an .srt file to get tappable subtitles.
            </div>
          </div>
          <button
            className="btn-primary"
            onClick={() => videoFileRef.current.click()}
          >
            <Upload size={17} /> Open Media File
          </button>
        </div>
      ) : (
        <>
          <div style={{ background: "#000" }}>
            <video
              ref={videoRef}
              src={videoSrc}
              controls
              style={{ width: "100%", maxHeight: "38vh", display: "block" }}
              onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
            />
          </div>

          <div className="subtitle-area">
            {currentSub ? (
              <ClickableText
                text={currentSub.text}
                onWordTap={onWordTap}
                fontSize={19}
                lineHeight={1.7}
              />
            ) : (
              <p className="subtitle-placeholder">
                {subtitles.length
                  ? "No subtitle at this moment"
                  : "No subtitles loaded — tap 'Load .srt' below"}
              </p>
            )}
          </div>

          <div className="media-controls">
            <button
              className={`pill-btn ${subtitles.length ? "active" : ""}`}
              onClick={() => srtFileRef.current.click()}
            >
              <FileText size={13} />
              {subtitles.length
                ? `${subtitles.length} subtitles`
                : "Load .srt"}
            </button>
            <button
              className="pill-btn"
              onClick={() => videoFileRef.current.click()}
            >
              <Upload size={13} /> New file
            </button>
            <button
              className="pill-btn danger"
              onClick={() => {
                setVideoSrc("");
                setSubtitles([]);
                setVideoName("");
              }}
            >
              <X size={13} /> Close
            </button>
          </div>
          <div className="file-name-bar">▶ {videoName}</div>
        </>
      )}
    </div>
  );
}

// ─── Tutor Tab ────────────────────────────────────────────────────────────────
function TutorTab({ flashcards }) {
  const [grammarBook, setGrammarBook] = useState("");
  const [bookName, setBookName] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chapter, setChapter] = useState(1);
  const fileRef = useRef();
  const chatRef = useRef();

  const handleFile = async (file) => {
    setBookName(file.name);
    try {
      let text = "";
      if (file.name.toLowerCase().endsWith(".txt")) {
        text = await file.text();
      } else if (file.name.toLowerCase().endsWith(".pdf")) {
        text = await extractPDFText(file);
      }
      setGrammarBook(text.slice(0, 8000));
      setMessages([
        {
          role: "assistant",
          text: `¡Hola! I've loaded **${file.name}**. I'm your Mexican Spanish tutor — we're starting at Chapter ${chapter}. You can ask me to explain a grammar concept, give you exercises, quiz you on vocabulary, or translate something. ¿Empezamos? 🌮`,
        },
      ]);
    } catch {
      setMessages([
        { role: "assistant", text: "Couldn't read that file. Try a .txt version." },
      ]);
    }
  };

  const startDirectChat = () => {
    setMessages([
      {
        role: "assistant",
        text: "¡Buenas! I'm your Mexican Spanish tutor. Ask me anything — grammar, slang, pronunciation, culture. ¿En qué te puedo ayudar? 🌮",
      },
    ]);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    const newMessages = [...messages, { role: "user", text: userMsg }];
    setMessages(newMessages);
    setLoading(true);

    const system = `You are an expert, warm Mexican Spanish tutor. The student is on Chapter ${chapter}. Always use Mexican Spanish examples and idioms (not Spain Spanish). Explain things clearly and concisely. Use occasional light Spanish throughout your replies. The student has ${flashcards.length} flashcards saved so far.${grammarBook ? `\n\nGrammar book excerpt (first 6000 chars):\n${grammarBook.slice(0, 6000)}` : ""}`;

    const apiMsgs = newMessages.map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.text,
    }));

    try {
      const reply = await callClaude(apiMsgs, system);
      setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Connection error — please try again." },
      ]);
    }
    setLoading(false);
  };

  useEffect(() => {
    setTimeout(
      () => chatRef.current?.scrollTo(0, chatRef.current.scrollHeight),
      80
    );
  }, [messages, loading]);

  return (
    <div className="tab-container">
      <input
        ref={fileRef}
        type="file"
        accept=".txt,.pdf"
        style={{ display: "none" }}
        onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
      />

      {messages.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <GraduationCap size={34} color="#e8a020" />
          </div>
          <div style={{ textAlign: "center" }}>
            <div className="empty-title">AI Tutor</div>
            <div className="empty-desc">
              Upload your grammar book for chapter-by-chapter tutoring,
              <br />
              or just start chatting about Mexican Spanish.
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn-primary" onClick={() => fileRef.current.click()}>
              <Upload size={16} /> Upload Book
            </button>
            <button className="btn-secondary" onClick={startDirectChat}>
              Chat Directly
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="tutor-header">
            {bookName && (
              <span className="file-name" style={{ flex: 1 }}>
                📚 {bookName}
              </span>
            )}
            {!bookName && <span style={{ flex: 1 }} />}
            <div className="chapter-control">
              <span style={{ fontSize: 11, color: "#8a7a5a" }}>Ch.</span>
              <button
                className="chap-btn"
                onClick={() => setChapter((c) => Math.max(1, c - 1))}
              >
                <ChevronLeft size={13} />
              </button>
              <span className="chap-num">{chapter}</span>
              <button
                className="chap-btn"
                onClick={() => setChapter((c) => c + 1)}
              >
                <ChevronRight size={13} />
              </button>
            </div>
            <button
              className="icon-btn"
              onClick={() => fileRef.current.click()}
              title="Change book"
            >
              <Upload size={14} />
            </button>
          </div>

          <div ref={chatRef} className="chat-body">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`chat-bubble-wrap ${msg.role === "user" ? "user" : "assistant"}`}
              >
                <div className={`chat-bubble ${msg.role}`}>{msg.text}</div>
              </div>
            ))}
            {loading && (
              <div className="chat-bubble-wrap assistant">
                <div className="chat-bubble assistant typing">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                </div>
              </div>
            )}
          </div>

          <div className="chat-input-row">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && !e.shiftKey && sendMessage()
              }
              placeholder="Ask your tutor anything…"
              className="chat-input"
            />
            <button
              onClick={sendMessage}
              disabled={loading}
              className={`send-btn ${loading ? "disabled" : ""}`}
            >
              <Send size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Tracker Tab ──────────────────────────────────────────────────────────────
function TrackerTab({ flashcards }) {
  const [sessions, setSessions] = useState([
    {
      type: "active",
      activity: "Grammar study – Chapter 1",
      minutes: 30,
      date: new Date(Date.now() - 86400000),
    },
    {
      type: "passive",
      activity: "Podcast — Español con Juan",
      minutes: 45,
      date: new Date(Date.now() - 172800000),
    },
  ]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: "active", activity: "", minutes: 30 });

  const totalActive = sessions
    .filter((s) => s.type === "active")
    .reduce((a, s) => a + s.minutes, 0);
  const totalPassive = sessions
    .filter((s) => s.type === "passive")
    .reduce((a, s) => a + s.minutes, 0);
  const totalHrs = ((totalActive + totalPassive) / 60).toFixed(1);

  const addSession = () => {
    if (!form.activity.trim()) return;
    setSessions((prev) => [...prev, { ...form, date: new Date() }]);
    setForm({ type: "active", activity: "", minutes: 30 });
    setShowForm(false);
  };

  return (
    <div className="tab-container" style={{ overflowY: "auto", paddingBottom: 24 }}>
      <div className="tracker-title">Input Tracker</div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Total Hours</div>
          <div className="stat-value amber">{totalHrs}<span className="stat-unit">hrs</span></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Flashcards</div>
          <div className="stat-value blue">{flashcards.length}<span className="stat-unit">cards</span></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Learning</div>
          <div className="stat-value green">{(totalActive / 60).toFixed(1)}<span className="stat-unit">hrs</span></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Passive Input</div>
          <div className="stat-value pink">{(totalPassive / 60).toFixed(1)}<span className="stat-unit">hrs</span></div>
        </div>
      </div>

      <button
        className="btn-primary full-width"
        onClick={() => setShowForm((v) => !v)}
        style={{ marginBottom: 14 }}
      >
        <Plus size={17} /> Log Session
      </button>

      {showForm && (
        <div className="log-form">
          <div className="form-row">
            <div className="form-label">Type</div>
            <div style={{ display: "flex", gap: 8 }}>
              {["active", "passive"].map((t) => (
                <button
                  key={t}
                  onClick={() => setForm((f) => ({ ...f, type: t }))}
                  className={`type-btn ${form.type === t ? "selected" : ""}`}
                >
                  {t === "active" ? "🎯 Active" : "🎧 Passive"}
                </button>
              ))}
            </div>
          </div>
          <div className="form-row">
            <div className="form-label">Activity</div>
            <input
              value={form.activity}
              onChange={(e) => setForm((f) => ({ ...f, activity: e.target.value }))}
              placeholder="e.g. Watched telenovela, Grammar Ch.3…"
              className="form-input"
            />
          </div>
          <div className="form-row">
            <div className="form-label">Duration — {form.minutes} min</div>
            <input
              type="range"
              min={5}
              max={180}
              step={5}
              value={form.minutes}
              onChange={(e) => setForm((f) => ({ ...f, minutes: +e.target.value }))}
              className="range-input"
            />
          </div>
          <button className="save-btn" onClick={addSession}>
            <Check size={15} /> Save Session
          </button>
        </div>
      )}

      <div className="section-label">Recent Sessions</div>
      {sessions
        .slice()
        .reverse()
        .map((s, i) => (
          <div key={i} className="session-card">
            <div className={`session-icon ${s.type}`}>
              {s.type === "active" ? "🎯" : "🎧"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="session-activity">{s.activity}</div>
              <div className="session-meta">
                {s.type} · {s.minutes} min · {s.date.toLocaleDateString()}
              </div>
            </div>
            <div className={`session-badge ${s.type}`}>+{s.minutes}m</div>
          </div>
        ))}
    </div>
  );
}

// ─── Translation Modal ────────────────────────────────────────────────────────
function TranslationModal({ modal, onClose, onAddCard }) {
  const [translation, setTranslation] = useState("");
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!modal) return;
    setTranslation("");
    setAdded(false);
    setLoading(true);
    callClaude(
      [
        {
          role: "user",
          content: `Translate this Mexican Spanish word to English: "${modal.word}"${modal.context ? `\n\nContext sentence: "${modal.context.slice(0, 220)}"` : ""}\n\nFormat your reply exactly like this:\n**Translation:** [English meaning]\n**Part of speech:** [noun / verb / adjective / etc]\n**Example:** [A short Spanish sentence using the word] → [English translation]\n\nBe concise.`,
        },
      ],
      "You are a concise Mexican Spanish–English dictionary and example generator."
    )
      .then((t) => setTranslation(t))
      .catch(() => setTranslation("Translation failed. Check connection."))
      .finally(() => setLoading(false));
  }, [modal]);

  if (!modal) return null;

  const handleAdd = () => {
    if (added || !translation) return;
    onAddCard({ word: modal.word, translation });
    setAdded(true);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-header">
          <div>
            <div className="modal-word">{modal.word}</div>
            <div className="modal-lang">Mexican Spanish</div>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={17} />
          </button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="loading-row">
              <Loader2 size={17} className="spin" />
              Translating with Claude…
            </div>
          ) : (
            <div className="translation-text">{translation}</div>
          )}
        </div>

        <button
          className={`add-card-btn ${added ? "added" : ""}`}
          onClick={handleAdd}
          disabled={added || loading || !translation}
        >
          {added ? (
            <><Check size={17} /> Added to Flashcards!</>
          ) : (
            <><Plus size={17} /> Add to Flashcards</>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── App Shell ────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState("reader");
  const [modal, setModal] = useState(null);
  const [flashcards, setFlashcards] = useState([]);

  const handleWordTap = (word, context) => setModal({ word, context });

  const tabs = [
    { id: "reader", icon: BookOpen, label: "Reader" },
    { id: "media", icon: Play, label: "Media" },
    { id: "tutor", icon: GraduationCap, label: "Tutor" },
    { id: "tracker", icon: BarChart3, label: "Tracker" },
  ];

  return (
    <>
      {/* Google Fonts */}
      <link
        href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Crimson+Pro:ital,wght@0,400;0,600;1,400&display=swap"
        rel="stylesheet"
      />

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0d0a06; }

        :root {
          --bg: #0d0a06;
          --surface: #1a1108;
          --surface2: #261a0c;
          --border: #32200e;
          --amber: #e8a020;
          --amber-dark: #b87010;
          --cream: #f0ddb8;
          --muted: #7a6840;
          --dim: #4a3820;
        }

        .app {
          background: var(--bg);
          min-height: 100vh;
          color: var(--cream);
          font-family: 'Outfit', sans-serif;
          display: flex;
          flex-direction: column;
          max-width: 820px;
          margin: 0 auto;
        }

        /* scrollbar */
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }

        /* header */
        .app-header {
          padding: 14px 20px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          gap: 12px;
          background: var(--bg);
          position: sticky;
          top: 0;
          z-index: 50;
        }
        .logo-mark {
          width: 36px; height: 36px;
          background: linear-gradient(135deg, var(--amber), var(--amber-dark));
          border-radius: 9px;
          display: flex; align-items: center; justify-content: center;
          font-size: 19px;
          box-shadow: 0 2px 12px rgba(232,160,32,0.3);
        }
        .logo-name { font-weight: 700; font-size: 16px; letter-spacing: 0.02em; }
        .logo-sub { font-size: 9px; color: var(--muted); letter-spacing: 0.1em; }
        .card-count {
          margin-left: auto;
          background: var(--surface2);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 4px 14px;
          font-size: 12px;
          color: var(--amber);
          font-weight: 600;
        }

        /* nav */
        .bottom-nav {
          display: flex;
          border-top: 1px solid var(--border);
          background: var(--bg);
          position: sticky;
          bottom: 0;
        }
        .nav-btn {
          flex: 1;
          padding: 10px 8px 14px;
          background: none;
          border: none;
          color: var(--dim);
          cursor: pointer;
          display: flex; flex-direction: column; align-items: center; gap: 5px;
          transition: color 0.2s;
          font-family: 'Outfit', sans-serif;
        }
        .nav-btn.active { color: var(--amber); }
        .nav-label { font-size: 9px; font-weight: 600; letter-spacing: 0.08em; }

        /* shared tab container */
        .tab-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          height: calc(100vh - 108px);
          overflow: hidden;
        }

        /* empty states */
        .empty-state {
          flex: 1;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 22px; padding: 32px 24px;
        }
        .empty-icon {
          width: 84px; height: 84px;
          background: linear-gradient(145deg, var(--surface2), var(--surface));
          border: 1px solid var(--border);
          border-radius: 22px;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        }
        .empty-title {
          font-family: 'Crimson Pro', serif;
          font-size: 26px; color: var(--cream); margin-bottom: 8px;
        }
        .empty-desc {
          font-size: 13px; color: var(--muted); line-height: 1.7; text-align: center;
        }

        /* buttons */
        .btn-primary {
          padding: 13px 28px;
          background: linear-gradient(135deg, var(--amber), var(--amber-dark));
          border: none; border-radius: 12px;
          color: #fff; font-weight: 700; font-size: 14px;
          cursor: pointer; display: flex; align-items: center; gap: 8px;
          font-family: 'Outfit', sans-serif;
          box-shadow: 0 4px 16px rgba(232,160,32,0.25);
          transition: opacity 0.2s;
        }
        .btn-primary:hover { opacity: 0.9; }
        .btn-primary.full-width { width: 100%; justify-content: center; }
        .btn-secondary {
          padding: 13px 28px;
          background: var(--surface2); border: 1px solid var(--border); border-radius: 12px;
          color: var(--cream); font-weight: 600; font-size: 14px;
          cursor: pointer; display: flex; align-items: center; gap: 8px;
          font-family: 'Outfit', sans-serif;
        }
        .icon-btn {
          background: none; border: none;
          color: var(--muted); cursor: pointer; padding: 4px;
          display: flex; align-items: center; border-radius: 6px;
          transition: color 0.2s;
        }
        .icon-btn:hover { color: var(--cream); }

        /* reader */
        .file-header {
          padding: 9px 16px;
          border-bottom: 1px solid var(--border);
          display: flex; align-items: center; gap: 8px;
        }
        .file-name {
          font-size: 12px; color: #b09870;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          flex: 1;
        }
        .page-count { font-size: 11px; color: var(--dim); white-space: nowrap; }
        .reader-body {
          flex: 1; overflow-y: auto;
          padding: 24px 22px;
        }
        .pagination {
          padding: 12px 16px;
          border-top: 1px solid var(--border);
          display: flex; justify-content: space-between; align-items: center;
        }
        .page-btn {
          padding: 8px 14px;
          background: var(--surface2); border: 1px solid var(--border);
          border-radius: 9px; color: var(--cream);
          cursor: pointer; font-size: 13px; font-family: 'Outfit', sans-serif;
          display: flex; align-items: center; gap: 4px; transition: background 0.2s;
        }
        .page-btn:hover { background: #2e1f0e; }
        .page-btn.disabled { color: var(--dim); cursor: default; }
        .new-file-btn {
          background: none; border: none;
          color: var(--muted); cursor: pointer; font-size: 12px;
          font-family: 'Outfit', sans-serif;
          display: flex; align-items: center; gap: 4px;
        }

        .tappable-word {
          cursor: pointer;
          border-bottom: 1px dotted rgba(232,160,32,0.45);
          padding: 0 1px; border-radius: 2px;
          transition: background 0.15s;
        }
        .tappable-word:hover { background: rgba(232,160,32,0.12); }

        /* media */
        .subtitle-area {
          padding: 18px 20px; min-height: 78px;
          background: var(--surface);
          border-bottom: 1px solid var(--border);
        }
        .subtitle-placeholder {
          color: var(--dim); font-size: 13px; font-style: italic; text-align: center;
          padding-top: 8px;
        }
        .media-controls {
          padding: 12px 16px; display: flex; gap: 8px; flex-wrap: wrap;
        }
        .pill-btn {
          padding: 7px 14px;
          background: var(--surface2); border: 1px solid var(--border);
          border-radius: 20px; color: var(--cream);
          cursor: pointer; font-size: 12px; font-family: 'Outfit', sans-serif;
          display: flex; align-items: center; gap: 5px; transition: background 0.2s;
        }
        .pill-btn.active { border-color: var(--amber); color: var(--amber); }
        .pill-btn.danger { color: #c06060; border-color: #5a2020; }
        .file-name-bar { padding: 0 16px 10px; font-size: 11px; color: var(--dim); }

        /* tutor */
        .tutor-header {
          padding: 10px 16px;
          border-bottom: 1px solid var(--border);
          display: flex; align-items: center; gap: 8px;
        }
        .chapter-control {
          display: flex; align-items: center; gap: 6px;
        }
        .chap-btn {
          width: 28px; height: 28px;
          background: var(--surface2); border: 1px solid var(--border);
          border-radius: 7px; color: var(--cream); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
        }
        .chap-num {
          font-size: 14px; font-weight: 700; color: var(--amber);
          min-width: 22px; text-align: center;
        }
        .chat-body {
          flex: 1; overflow-y: auto;
          padding: 16px;
          display: flex; flex-direction: column; gap: 12px;
        }
        .chat-bubble-wrap {
          display: flex;
        }
        .chat-bubble-wrap.user { justify-content: flex-end; }
        .chat-bubble-wrap.assistant { justify-content: flex-start; }
        .chat-bubble {
          max-width: 86%;
          padding: 11px 16px;
          font-size: 14px; line-height: 1.75;
          white-space: pre-wrap;
        }
        .chat-bubble.user {
          background: linear-gradient(135deg, var(--amber), var(--amber-dark));
          border-radius: 18px 18px 4px 18px;
          color: #fff;
        }
        .chat-bubble.assistant {
          background: var(--surface2);
          border: 1px solid var(--border);
          border-radius: 18px 18px 18px 4px;
          color: #d4bc90;
        }
        .chat-bubble.typing {
          display: flex; align-items: center; gap: 6px;
          padding: 14px 18px;
        }
        .dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: var(--amber);
          animation: bounce 1.1s ease infinite;
        }
        .dot:nth-child(2) { animation-delay: 0.18s; }
        .dot:nth-child(3) { animation-delay: 0.36s; }
        .chat-input-row {
          padding: 12px 16px;
          border-top: 1px solid var(--border);
          display: flex; gap: 10px;
        }
        .chat-input {
          flex: 1;
          background: var(--surface2); border: 1px solid var(--border);
          border-radius: 12px; padding: 10px 16px;
          color: var(--cream); font-size: 14px;
          outline: none; font-family: 'Outfit', sans-serif;
        }
        .chat-input::placeholder { color: var(--dim); }
        .chat-input:focus { border-color: var(--amber); }
        .send-btn {
          padding: 10px 16px;
          background: linear-gradient(135deg, var(--amber), var(--amber-dark));
          border: none; border-radius: 12px; color: #fff;
          cursor: pointer; display: flex; align-items: center;
          transition: opacity 0.2s;
        }
        .send-btn.disabled { opacity: 0.4; cursor: default; }

        /* tracker */
        .tracker-title {
          font-family: 'Crimson Pro', serif;
          font-size: 24px; color: var(--cream);
          padding: 18px 18px 10px;
        }
        .stat-grid {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 10px; padding: 0 16px 14px;
        }
        .stat-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 14px; padding: 14px 18px;
        }
        .stat-label { font-size: 11px; color: var(--muted); margin-bottom: 6px; letter-spacing: 0.04em; }
        .stat-value { font-size: 28px; font-weight: 700; }
        .stat-value.amber { color: var(--amber); }
        .stat-value.blue { color: #60a8e8; }
        .stat-value.green { color: #60cc80; }
        .stat-value.pink { color: #d870b0; }
        .stat-unit { font-size: 13px; font-weight: 400; margin-left: 4px; color: var(--muted); }

        .log-form {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 14px; padding: 18px 16px;
          margin: 0 0 14px; animation: fadeIn 0.2s ease;
        }
        .form-row { margin-bottom: 14px; }
        .form-label { font-size: 11px; color: var(--muted); margin-bottom: 7px; letter-spacing: 0.04em; }
        .type-btn {
          flex: 1; padding: 9px;
          background: var(--surface2); border: 1px solid var(--border);
          border-radius: 8px; color: var(--muted);
          cursor: pointer; font-size: 13px; font-weight: 600;
          font-family: 'Outfit', sans-serif;
          transition: all 0.2s;
        }
        .type-btn.selected {
          background: linear-gradient(135deg, var(--amber), var(--amber-dark));
          border-color: transparent; color: #fff;
        }
        .form-input {
          width: 100%;
          background: var(--surface2); border: 1px solid var(--border);
          border-radius: 9px; padding: 10px 13px;
          color: var(--cream); font-size: 14px;
          outline: none; font-family: 'Outfit', sans-serif;
        }
        .form-input:focus { border-color: var(--amber); }
        .range-input {
          width: 100%; -webkit-appearance: none;
          height: 4px; background: var(--border); border-radius: 2px; outline: none;
        }
        .range-input::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 18px; height: 18px; border-radius: 50%;
          background: var(--amber); cursor: pointer;
        }
        .save-btn {
          width: 100%; padding: 11px;
          background: rgba(96,204,128,0.12); border: 1px solid rgba(96,204,128,0.3);
          border-radius: 9px; color: #60cc80;
          font-weight: 700; cursor: pointer; font-family: 'Outfit', sans-serif;
          display: flex; align-items: center; justify-content: center; gap: 6px;
          font-size: 14px; transition: background 0.2s;
        }
        .save-btn:hover { background: rgba(96,204,128,0.2); }
        .section-label {
          font-size: 11px; color: var(--muted);
          letter-spacing: 0.08em; padding: 4px 16px 8px;
        }
        .session-card {
          display: flex; align-items: center; gap: 12px;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 11px; padding: 12px 14px;
          margin: 0 0 8px; transition: border-color 0.2s;
        }
        .session-icon {
          width: 36px; height: 36px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center; font-size: 17px;
        }
        .session-icon.active { background: rgba(96,204,128,0.12); }
        .session-icon.passive { background: rgba(216,112,176,0.12); }
        .session-activity { font-size: 14px; color: var(--cream); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .session-meta { font-size: 11px; color: var(--dim); margin-top: 2px; }
        .session-badge { font-size: 13px; font-weight: 700; white-space: nowrap; }
        .session-badge.active { color: #60cc80; }
        .session-badge.passive { color: #d870b0; }

        /* modal */
        .modal-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.78);
          display: flex; align-items: flex-end;
          z-index: 200;
          backdrop-filter: blur(6px);
        }
        .modal-sheet {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 22px 22px 0 0;
          padding: 10px 20px 28px;
          width: 100%; max-width: 820px;
          max-height: 70vh; overflow-y: auto;
          animation: slideUp 0.28s cubic-bezier(0.22,1,0.36,1);
        }
        .modal-handle {
          width: 42px; height: 4px;
          background: var(--border); border-radius: 2px;
          margin: 0 auto 18px;
        }
        .modal-header {
          display: flex; justify-content: space-between; align-items: flex-start;
          margin-bottom: 18px;
        }
        .modal-word {
          font-family: 'Crimson Pro', serif;
          font-size: 32px; font-weight: 600; color: var(--amber);
          line-height: 1.1;
        }
        .modal-lang { font-size: 10px; color: var(--muted); letter-spacing: 0.08em; margin-top: 3px; }
        .modal-body { margin-bottom: 20px; }
        .translation-text {
          font-size: 15px; line-height: 1.85;
          color: #c8b080; white-space: pre-wrap;
          border-left: 2px solid var(--border);
          padding-left: 14px;
        }
        .add-card-btn {
          width: 100%; padding: 14px;
          background: linear-gradient(135deg, var(--amber), var(--amber-dark));
          border: none; border-radius: 13px;
          color: #fff; font-weight: 700; font-size: 15px;
          cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
          font-family: 'Outfit', sans-serif;
          box-shadow: 0 4px 20px rgba(232,160,32,0.3);
          transition: all 0.3s;
        }
        .add-card-btn.added {
          background: rgba(96,204,128,0.12);
          border: 1px solid rgba(96,204,128,0.35);
          color: #60cc80; cursor: default; box-shadow: none;
        }
        .add-card-btn:disabled:not(.added) { opacity: 0.4; cursor: default; }

        /* utils */
        .loading-row {
          display: flex; align-items: center; gap: 10px;
          color: var(--muted); font-size: 14px; padding: 12px 0;
        }
        .spin { animation: spin 1s linear infinite; }

        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-7px); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>

      <div className="app">
        <header className="app-header">
          <div className="logo-mark">🌮</div>
          <div>
            <div className="logo-name">LinguaMex</div>
            <div className="logo-sub">COMPREHENSIBLE INPUT</div>
          </div>
          <div className="card-count">{flashcards.length} cards</div>
        </header>

        <div style={{ flex: 1, overflow: "hidden" }}>
          {activeTab === "reader" && <ReaderTab onWordTap={handleWordTap} />}
          {activeTab === "media" && <MediaTab onWordTap={handleWordTap} />}
          {activeTab === "tutor" && <TutorTab flashcards={flashcards} />}
          {activeTab === "tracker" && <TrackerTab flashcards={flashcards} />}
        </div>

        <nav className="bottom-nav">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`nav-btn ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon size={20} />
              <span className="nav-label">{tab.label.toUpperCase()}</span>
            </button>
          ))}
        </nav>

        <TranslationModal
          modal={modal}
          onClose={() => setModal(null)}
          onAddCard={(card) =>
            setFlashcards((prev) => [...prev, { ...card, date: new Date() }])
          }
        />
      </div>
    </>
  );
}
