// ChatPage — live journaling session with streaming Gemini responses, now with a rich text editor

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, LayoutGroup } from "framer-motion";
import { ArrowLeft, CheckCircle, Loader2, Copy, Bold, Italic, Underline, Heading1, Heading2, Heading3, Trash2 } from "lucide-react";
import { useMessages, useSessions } from "@/lib/hooks";
import { streamChat, summarizeSession } from "@/lib/api";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassCard } from "@/components/ui/GlassCard";

// Tiptap
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TiptapUnderlineExt from "@tiptap/extension-underline";
import { TextStyle, Color } from "@tiptap/extension-text-style";

export function ChatPage() {
  const { id: sessionId }     = useParams<{ id: string }>();
  const navigate              = useNavigate();
  const { messages }          = useMessages(sessionId);
  const { sessions, completeSession, updateSessionTitle, updateSessionContent, deleteSession } = useSessions();

  const session = sessions.find((s) => s.id === sessionId);

  const [isStreaming,     setIsStreaming]      = useState(false);
  const [completing,      setCompleting]       = useState(false);
  const [sendError,       setSendError]        = useState<string | null>(null);

  // Editable Title State — initialised from URL session once Firestore loads
  const [title, setTitle] = useState("");
  const [titleInitialised, setTitleInitialised] = useState(false);

  useEffect(() => {
    if (session?.title && !titleInitialised) {
      setTitle(session.title);
      setTitleInitialised(true);
    }
  }, [session?.title, titleInitialised]);

  // Keep title in sync when session updates (e.g. from another tab)
  useEffect(() => {
    if (session?.title && titleInitialised) {
      setTitle(session.title);
    }
  }, [session?.title]); // eslint-disable-line

  const handleTitleBlur = () => {
    if (title.trim() !== session?.title && sessionId) {
      updateSessionTitle(sessionId, title.trim() || "Journal Entry");
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      (e.currentTarget as HTMLElement).blur();
    }
  };

  const handleDelete = async () => {
    if (!sessionId || !window.confirm("Are you sure you want to delete this journal?")) return;
    try {
      await deleteSession(sessionId);
      navigate("/");
    } catch (err) {
      console.error("Failed to delete session", err);
    }
  };

  // Use a ref for session to avoid stale closures in Tiptap's onUpdate
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Setup Tiptap Editor
  const editor = useEditor({
    extensions: [
      // Exclude underline from StarterKit — we register it explicitly below
      // to avoid the "Duplicate extension names found: ['underline']" warning
      StarterKit.configure({ }),
      TiptapUnderlineExt,
      TextStyle,
      Color,
    ],
    content: session?.content || "",
    onUpdate: ({ editor }) => {
      // Autosave content changes to Firestore
      // Use sessionRef to avoid saving empty text on initial mount before sessions load
      if (sessionId && sessionRef.current && !sessionRef.current.isComplete) {
        updateSessionContent(sessionId, editor.getHTML());
      }
    },
    editable: !session?.isComplete,
  });

  // Initialize editor content once session loads
  const contentInitialised = useRef(false);
  useEffect(() => {
    console.log("[ChatPage] Session loaded. Content:", session?.content);
    if (editor && session?.content && !contentInitialised.current) {
      console.log("[ChatPage] Setting editor content to:", session.content);
      editor.commands.setContent(session.content);
      contentInitialised.current = true;
    }
  }, [editor, session?.content]);

  // Handle loading legacy messages if they exist but no content exists
  const hasLoadedLegacyMessages = useRef(false);
  useEffect(() => {
    if (editor && !session?.content && messages.length > 0 && !hasLoadedLegacyMessages.current) {
      hasLoadedLegacyMessages.current = true;
      const legacyHtml = messages.map(m => {
        const prefix = m.role === "user" ? "" : "<strong>Gemini:</strong> ";
        return `<p>${prefix}${m.content}</p>`;
      }).join("");
      editor.commands.setContent(legacyHtml);
      if (sessionId) updateSessionContent(sessionId, legacyHtml);
    }
  }, [messages, session?.content, editor, sessionId, updateSessionContent]);

  // Sync editability
  useEffect(() => {
    if (editor) {
      editor.setEditable(!session?.isComplete && !isStreaming);
    }
  }, [editor, session?.isComplete, isStreaming]);

  // Copy to clipboard with fallback
  const [copyMsg, setCopyMsg] = useState("");
  const handleCopy = async () => {
    if (!editor) return;
    const text = editor.getText();
    try {
      await navigator.clipboard.writeText(text);
      setCopyMsg("Copied!");
    } catch {
      // Fallback: create a textarea and use execCommand
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopyMsg("Copied!");
    }
    setTimeout(() => setCopyMsg(""), 2000);
  };

  // Get Gemini response
  const handleReflect = useCallback(async () => {
    if (isStreaming || !sessionId || !editor) return;

    setSendError(null);
    setIsStreaming(true);

    const currentText = editor.getText();
    
    // Add a loading indicator paragraph or just append the streaming text
    editor.commands.focus('end');
    editor.commands.insertContent('<p><br></p><p><strong>Gemini:</strong> </p>');

    await streamChat(
      sessionId,
      `Respond to the following journal entry as a helpful AI assistant. Provide insights or questions to help the user reflect:\n\n${currentText}`,
      (chunk) => {
        editor.commands.insertContent(chunk);
      },
      () => {
        setIsStreaming(false);
        // Force save after stream finishes
        updateSessionContent(sessionId, editor.getHTML());
      },
      (err) => {
        setIsStreaming(false);
        setSendError(err.message);
      },
    );
  }, [isStreaming, sessionId, editor, updateSessionContent]);

  async function handleComplete() {
    if (!sessionId) return;
    setCompleting(true);
    
    // Force save the latest content before completing
    if (editor) {
      try {
        const html = editor.getHTML();
        console.log("[ChatPage] Saving final content:", html);
        await updateSessionContent(sessionId, html);
        console.log("[ChatPage] Final content saved successfully");
      } catch (err) {
        console.error("[ChatPage] Failed to save final content:", err);
      }
    }

    try {
      await completeSession(sessionId);
      // Backend is known to be failing locally, catch error gracefully
      await summarizeSession(sessionId).catch(err => {
        console.warn("Backend summarize failed (running without Java), ignoring.", err);
      });
    } catch (err) {
      console.error("[ChatPage] Complete session failed:", err);
    }
    setCompleting(false);
    navigate("/");
  }

  return (
    <LayoutGroup>
      <div
        style={{
          display:       "flex",
          flexDirection: "column",
          height:        "calc(100dvh - 64px)",
          maxWidth:      "900px",
          margin:        "0 auto",
          padding:       "0 var(--space-4)",
        }}
      >
        {/* Session header */}
        <motion.div
          layoutId={`session-card-${sessionId}`}
          style={{
            display:        "flex",
            alignItems:     "center",
            gap:            "var(--space-3)",
            padding:        "var(--space-4) 0",
            flexShrink:     0,
          }}
        >
          <GlassButton
            variant="ghost"
            size="sm"
            icon={<ArrowLeft size={16} />}
            onClick={() => navigate("/")}
            aria-label="Back to journal"
          />

          <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
              disabled={session?.isComplete}
              style={{
                fontSize: "var(--text-lg)",
                fontWeight: 600,
                background: "transparent",
                border: "none",
                borderBottom: !session?.isComplete ? "1px dashed var(--text-muted)" : "none",
                outline: "none",
                color: "var(--text-primary)",
                width: "100%",
                padding: "var(--space-1) 0",
              }}
              placeholder="Journal Entry"
              title={!session?.isComplete ? "Edit title" : ""}
            />
          </div>

          <GlassButton
            variant="ghost"
            size="sm"
            icon={<Copy size={16} />}
            onClick={handleCopy}
            aria-label="Copy Journal"
          >
            {copyMsg || "Copy"}
          </GlassButton>

          <GlassButton
            variant="ghost"
            size="sm"
            icon={<Trash2 size={16} />}
            onClick={handleDelete}
            aria-label="Delete Journal"
            style={{ color: "var(--danger)" }}
          >
            Delete
          </GlassButton>

          {!session?.isComplete && (
            <GlassButton
              variant="ghost"
              size="sm"
              loading={completing}
              icon={<CheckCircle size={16} />}
              onClick={handleComplete}
              style={{ color: "var(--sentiment-positive)" }}
            >
              Complete
            </GlassButton>
          )}
        </motion.div>

        {/* Toolbar */}
        {editor && !session?.isComplete && (
          <GlassCard style={{ display: "flex", gap: "var(--space-2)", padding: "var(--space-2)", marginBottom: "var(--space-4)" }}>
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              disabled={!editor.can().chain().focus().toggleBold().run()}
              style={{ padding: "var(--space-2)", background: editor.isActive('bold') ? "var(--glass-bg)" : "transparent", borderRadius: "var(--radius-sm)", border: "none", cursor: "pointer", color: "var(--text-primary)" }}
            ><Bold size={16} /></button>
            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              disabled={!editor.can().chain().focus().toggleItalic().run()}
              style={{ padding: "var(--space-2)", background: editor.isActive('italic') ? "var(--glass-bg)" : "transparent", borderRadius: "var(--radius-sm)", border: "none", cursor: "pointer", color: "var(--text-primary)" }}
            ><Italic size={16} /></button>
            <button
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              disabled={!editor.can().chain().focus().toggleUnderline().run()}
              style={{ padding: "var(--space-2)", background: editor.isActive('underline') ? "var(--glass-bg)" : "transparent", borderRadius: "var(--radius-sm)", border: "none", cursor: "pointer", color: "var(--text-primary)" }}
            ><Underline size={16} /></button>
            <div style={{ width: "1px", background: "var(--glass-border)", margin: "0 var(--space-2)" }} />
            <input
              type="color"
              onInput={(e) => editor.chain().focus().setColor(e.currentTarget.value).run()}
              value={editor.getAttributes('textStyle').color || '#000000'}
              style={{ padding: 0, border: "none", width: "24px", height: "24px", cursor: "pointer", alignSelf: "center", borderRadius: "var(--radius-sm)", background: "transparent" }}
              title="Text Color"
            />
            <div style={{ width: "1px", background: "var(--glass-border)", margin: "0 var(--space-2)" }} />
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              style={{ padding: "var(--space-2)", background: editor.isActive('heading', { level: 1 }) ? "var(--glass-bg)" : "transparent", borderRadius: "var(--radius-sm)", border: "none", cursor: "pointer", color: "var(--text-primary)" }}
            ><Heading1 size={16} /></button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              style={{ padding: "var(--space-2)", background: editor.isActive('heading', { level: 2 }) ? "var(--glass-bg)" : "transparent", borderRadius: "var(--radius-sm)", border: "none", cursor: "pointer", color: "var(--text-primary)" }}
            ><Heading2 size={16} /></button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              style={{ padding: "var(--space-2)", background: editor.isActive('heading', { level: 3 }) ? "var(--glass-bg)" : "transparent", borderRadius: "var(--radius-sm)", border: "none", cursor: "pointer", color: "var(--text-primary)" }}
            ><Heading3 size={16} /></button>
          </GlassCard>
        )}

        {/* Editor Area with Background */}
        <div style={{ 
          flex: 1, 
          display: "flex", 
          flexDirection: "column", 
          gap: "var(--space-3)", 
          position: "relative",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--glass-shadow)",
          border: "1px solid var(--glass-border)",
          overflow: "hidden"
        }}>
          {/* Background Image Layer */}
          <div style={{
            position: "absolute",
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundImage: "url('/bg.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.9, 
            zIndex: -1
          }} />
          
          <div className="scroll-area" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
            <EditorContent 
              editor={editor} 
              style={{ 
                flex: 1, 
                padding: "var(--space-8)", 
                color: "var(--text-primary)", 
                fontSize: "var(--text-base)",
                minHeight: "100%",
                background: "rgba(255, 255, 255, 0.4)", // Slight white overlay for readability if background is busy
                backdropFilter: "blur(4px)"
              }} 
              className="tiptap-editor" 
            />
          </div>

          {sendError && (
            <div style={{ padding: "var(--space-3)", margin: "var(--space-4)", background: "var(--danger-subtle)", borderRadius: "var(--radius-md)", color: "var(--danger)", fontSize: "var(--text-sm)" }}>
              {sendError}
            </div>
          )}

          {!session?.isComplete && (
            <div style={{ display: "flex", justifyContent: "flex-end", padding: "var(--space-4)", background: "rgba(255,255,255,0.4)", backdropFilter: "blur(4px)", borderTop: "1px solid var(--glass-border)" }}>
              <GlassButton
                variant="primary"
                size="md"
                onClick={handleReflect}
                disabled={isStreaming}
                icon={isStreaming ? <Loader2 size={16} style={{ animation: "spin 0.7s linear infinite" }} /> : undefined}
              >
                {isStreaming ? "Gemini is reflecting..." : "Get Gemini Insights"}
              </GlassButton>
            </div>
          )}
        </div>
      </div>
    </LayoutGroup>
  );
}
