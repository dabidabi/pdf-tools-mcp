import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  Download,
  FileText,
  FileUp,
  Loader2,
  Plus,
  Sparkles,
  X
} from "lucide-react";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { parseLocalCommand } from "./lib/commandParser";
import { createDocumentFromBytes, loadPdfFile, runPdfOperation } from "./lib/pdfActions";
import type { ApiParseResponse, ChatAttachment, ChatMessage, LocalPdfDocument, ParsedCommand, PdfOutput } from "./lib/types";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const EXAMPLES = [
  "Inspect this PDF",
  "Extract pages 1-3",
  "Delete page 2",
  "Rotate page 1 by 90",
  "Merge all PDFs"
];

export function App() {
  const [documents, setDocuments] = useState<LocalPdfDocument[]>([]);
  const [pendingDocuments, setPendingDocuments] = useState<LocalPdfDocument[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<PdfOutput[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [limit, setLimit] = useState(10);
  const [isDragging, setIsDragging] = useState(false);
  const [previewScroll, setPreviewScroll] = useState({ visible: false, top: 0, height: 0 });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const previewSurfaceRef = useRef<HTMLDivElement | null>(null);

  const allDocuments = useMemo(() => [...documents, ...pendingDocuments], [documents, pendingDocuments]);

  const activeDocument = useMemo(
    () => allDocuments.find((document) => document.id === activeId) ?? allDocuments[0] ?? null,
    [activeId, allDocuments]
  );

  const outputsById = useMemo(() => new Map(outputs.map((output) => [output.id, output])), [outputs]);

  useEffect(() => {
    const node = messagesRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const node = previewSurfaceRef.current;
    if (!node) return;
    node.scrollTop = 0;
    node.scrollLeft = 0;
    requestAnimationFrame(updatePreviewScroll);
    const timer = window.setTimeout(updatePreviewScroll, 500);
    return () => window.clearTimeout(timer);
  }, [activeDocument?.id]);

  function updatePreviewScroll() {
    const node = previewSurfaceRef.current;
    if (!node) return;

    const visible = node.scrollHeight > node.clientHeight + 2;
    if (!visible) {
      setPreviewScroll((current) => (current.visible ? { visible: false, top: 0, height: 0 } : current));
      return;
    }

    const trackHeight = Math.max(80, node.clientHeight - 24);
    const thumbHeight = Math.max(48, Math.round((node.clientHeight / node.scrollHeight) * trackHeight));
    const maxThumbTop = Math.max(0, trackHeight - thumbHeight);
    const scrollRange = Math.max(1, node.scrollHeight - node.clientHeight);
    const thumbTop = Math.round((node.scrollTop / scrollRange) * maxThumbTop);
    const next = { visible: true, top: thumbTop, height: thumbHeight };
    setPreviewScroll((current) =>
      current.visible === next.visible && current.top === next.top && current.height === next.height ? current : next
    );
  }

  async function handleFiles(files: FileList | File[]) {
    const pdfs = Array.from(files).filter((file) => /\.pdf$/i.test(file.name) || file.type === "application/pdf");
    if (pdfs.length === 0) return;

    setIsLoadingFiles(true);
    try {
      const loaded = await Promise.all(pdfs.map(loadPdfFile));
      setPendingDocuments((current) => [...current, ...loaded]);
      setActiveId(loaded[0]?.id ?? activeDocument?.id ?? null);
      textareaRef.current?.focus();
    } catch (error) {
      addAssistant(errorMessage(error), undefined, "error");
    } finally {
      setIsLoadingFiles(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const text = prompt.trim();
    if (!text || isRunning) return;

    const submittedDocuments = [...documents, ...pendingDocuments];
    const submittedActiveDocument =
      submittedDocuments.find((document) => document.id === activeId) ?? submittedDocuments[0] ?? null;
    const submittedAttachments = pendingDocuments.map(pdfAttachment);

    addUser(text, submittedAttachments.length > 0 ? submittedAttachments : undefined);
    setPrompt("");
    setPendingDocuments([]);

    if (!submittedActiveDocument) {
      addAssistant("Add a PDF first, then tell me what to do with it.");
      return;
    }

    if (pendingDocuments.length > 0) {
      setDocuments(submittedDocuments);
    }
    setActiveId(submittedActiveDocument.id);

    setIsRunning(true);
    try {
      const parsed = await parseCommand(text, submittedDocuments, submittedActiveDocument);
      if (parsed.remaining !== undefined) setRemaining(parsed.remaining);
      if (parsed.limit !== undefined) setLimit(parsed.limit);
      const result = await runPdfOperation(parsed.operation, submittedActiveDocument, submittedDocuments);

      if (result.outputs.length > 0) {
        setOutputs((current) => [...result.outputs, ...current]);
        const generated = await Promise.all(
          result.outputs.map((output) => createDocumentFromBytes(output.name, output.bytes))
        );
        setDocuments([...submittedDocuments, ...generated]);
        setActiveId(generated[0]?.id ?? submittedActiveDocument.id);
        addAssistant(
          `${sourceLabel(parsed.source)} · ${result.message}`,
          generated.map((document, index) => resultAttachment(document, result.outputs[index]))
        );
      } else {
        addAssistant(`${sourceLabel(parsed.source)} · ${result.message}`);
      }
    } catch (error) {
      addAssistant(errorMessage(error), undefined, "error");
    } finally {
      setIsRunning(false);
    }
  }

  function handlePaste(event: React.ClipboardEvent) {
    const files = Array.from(event.clipboardData.files).filter(
      (file) => /\.pdf$/i.test(file.name) || file.type === "application/pdf"
    );
    if (files.length === 0) return;
    event.preventDefault();
    event.stopPropagation();
    handleFiles(files);
  }

  function pickExample(example: string) {
    setPrompt(example);
    textareaRef.current?.focus();
  }

  function removePendingDocument(documentId: string) {
    setPendingDocuments((current) => current.filter((document) => document.id !== documentId));
    if (activeId === documentId) {
      const nextDocument =
        documents[0] ?? pendingDocuments.find((document) => document.id !== documentId) ?? null;
      setActiveId(nextDocument?.id ?? null);
    }
  }

  function addUser(text: string, attachments?: ChatAttachment[]) {
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text, attachments }]);
  }

  function addAssistant(text: string, attachments?: ChatAttachment[], variant?: "error") {
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text, attachments, variant }]);
  }

  return (
    <main
      className={`app-shell ${isDragging ? "is-dragging" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        if (!isDragging) setIsDragging(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setIsDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
      onPaste={handlePaste}
    >
      <section className="workspace">
        <div className="preview-toolbar">
          <div className="document-chip" title={activeDocument?.name ?? "No document"}>
            <FileText size={17} />
            <span>{activeDocument?.name ?? "No document yet"}</span>
            {activeDocument ? <b aria-label={`${activeDocument.pageCount} pages`}>{activeDocument.pageCount}</b> : null}
          </div>
          {allDocuments.length > 1 ? (
            <div className="doc-switcher" role="tablist" aria-label="Open documents">
              {allDocuments.map((document) => (
                <button
                  key={document.id}
                  type="button"
                  role="tab"
                  aria-selected={document.id === activeDocument?.id}
                  className={`doc-tab ${document.id === activeDocument?.id ? "is-active" : ""} ${
                    pendingDocuments.some((pending) => pending.id === document.id) ? "is-pending" : ""
                  }`}
                  title={document.name}
                  onClick={() => setActiveId(document.id)}
                >
                  <FileText size={13} />
                  <span>{document.name}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="preview-surface" ref={previewSurfaceRef} onScroll={updatePreviewScroll}>
          {activeDocument ? (
            <PdfScrollView document={activeDocument} />
          ) : (
            <button
              type="button"
              className="empty-preview"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="empty-preview-art" aria-hidden>
                <FileText size={54} strokeWidth={1.25} />
                <span className="empty-preview-badge">
                  <Plus size={16} />
                </span>
              </div>
              <div className="empty-preview-copy">
                <strong>Drop a PDF to begin</strong>
                <span>Drag &amp; drop, paste, or click to browse. Files never leave your browser.</span>
              </div>
            </button>
          )}
        </div>
        {previewScroll.visible ? (
          <div className="preview-scroll-rail" aria-hidden="true">
            <span
              className="preview-scroll-thumb"
              style={{ height: `${previewScroll.height}px`, transform: `translateY(${previewScroll.top}px)` }}
            />
          </div>
        ) : null}
      </section>

      <aside className="chat-panel">
        <div className="chat-header">
          <div className="brand">
            <span className="brand-mark" aria-hidden>
              <FileText size={16} />
            </span>
            <span className="brand-name">PDF Studio</span>
          </div>
          <div className="quota-pill" title={`${remaining ?? limit} of ${limit} AI commands left today`}>
            <Sparkles size={14} />
            <span>{remaining ?? limit}</span>
          </div>
          <input
            ref={fileInputRef}
            className="sr-only"
            type="file"
            accept="application/pdf"
            multiple
            onChange={(event) => {
              if (event.target.files) handleFiles(event.target.files);
              event.currentTarget.value = "";
            }}
          />
        </div>

        <div className="messages" ref={messagesRef}>
          {messages.length === 0 ? (
            <div className="empty-chat">
              <h1>Edit PDFs by chatting.</h1>
              <p>Merge, split, extract, delete, rotate, or reorder pages — just say what you need.</p>
              <div className="suggestions">
                {EXAMPLES.map((example) => (
                  <button key={example} type="button" className="suggestion" onClick={() => pickExample(example)}>
                    {example}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <ChatBubble
                key={message.id}
                activeDocumentId={activeDocument?.id ?? null}
                message={message}
                outputsById={outputsById}
                onPreview={(documentId) => setActiveId(documentId)}
              />
            ))
          )}
          {isRunning ? (
            <div className="message assistant is-thinking">
              <Loader2 className="spin" size={15} />
              <span>Working…</span>
            </div>
          ) : null}
        </div>

        <form className="composer" onSubmit={handleSubmit}>
          {pendingDocuments.length > 0 ? (
            <div className="pending-attachments" aria-label="Pending PDFs">
              {pendingDocuments.map((document) => (
                <PendingAttachmentCard
                  key={document.id}
                  document={document}
                  isActive={document.id === activeDocument?.id}
                  onPreview={() => setActiveId(document.id)}
                  onRemove={() => removePendingDocument(document.id)}
                />
              ))}
            </div>
          ) : null}
          <button
            className="composer-upload"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoadingFiles}
            title="Add PDF"
            aria-label="Add PDF"
          >
            {isLoadingFiles ? <Loader2 className="spin" size={18} /> : <FileUp size={18} />}
          </button>
          <textarea
            ref={textareaRef}
            value={prompt}
            placeholder={activeDocument ? "Tell me what to do…" : "Add PDFs, then ask…"}
            aria-label="PDF command"
            rows={1}
            onChange={(event) => setPrompt(event.target.value)}
            onPaste={handlePaste}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button className="send-button" title="Send" aria-label="Send" type="submit" disabled={isRunning || !prompt.trim()}>
            {isRunning ? <Loader2 className="spin" size={18} /> : <ArrowUp size={18} />}
          </button>
        </form>
      </aside>
    </main>
  );
}

function usePdfjsDocument(bytes: Uint8Array) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let loaded: PDFDocumentProxy | null = null;
    setPdf(null);
    setError(null);

    const task = getDocument({ data: new Uint8Array(bytes) });
    task.promise
      .then((document) => {
        loaded = document;
        if (cancelled) {
          document.destroy();
          return;
        }
        setPdf(document);
      })
      .catch((loadError) => {
        if (!cancelled) setError(errorMessage(loadError));
      });

    return () => {
      cancelled = true;
      if (loaded) loaded.destroy();
      else task.destroy();
    };
  }, [bytes]);

  return { pdf, error };
}

function PdfScrollView({ document }: { document: LocalPdfDocument }) {
  const { pdf, error } = usePdfjsDocument(document.bytes);

  if (error) {
    return <div className="preview-status canvas-error">{error}</div>;
  }

  if (!pdf) {
    return (
      <div className="preview-status">
        <Loader2 className="spin" size={22} />
      </div>
    );
  }

  return (
    <div className="pdf-scroll">
      {document.pages.map((page) => (
        <div className="pdf-page" key={page.page}>
          <div className="pdf-page-frame">
            <PdfPageCanvas pdf={pdf} pageNumber={page.page} />
          </div>
          <div className="pdf-page-label">{page.page}</div>
        </div>
      ))}
    </div>
  );
}

function PdfPageCanvas({ pdf, pageNumber }: { pdf: PDFDocumentProxy; pageNumber: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: RenderTask | null = null;

    async function render() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      setError(null);

      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const availableWidth = Math.max(canvas.parentElement?.clientWidth ?? 720, 280) - 8;
        const scale = Math.min(availableWidth / baseViewport.width, 3);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale });
        const context = canvas.getContext("2d");
        if (!context || cancelled) return;

        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        context.setTransform(dpr, 0, 0, dpr, 0, 0);

        renderTask = page.render({ canvasContext: context, viewport });
        await renderTask.promise;
      } catch (renderError) {
        const name = (renderError as { name?: string } | null)?.name;
        if (!cancelled && name !== "RenderingCancelledException") {
          setError(errorMessage(renderError));
        }
      }
    }

    render();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdf, pageNumber]);

  return (
    <div className="canvas-wrap">
      <canvas ref={canvasRef} />
      {error ? <div className="canvas-error">{error}</div> : null}
    </div>
  );
}

function ChatBubble({
  message,
  activeDocumentId,
  outputsById,
  onPreview
}: {
  message: ChatMessage;
  activeDocumentId: string | null;
  outputsById: Map<string, PdfOutput>;
  onPreview: (documentId: string) => void;
}) {
  return (
    <div className={`message ${message.role} ${message.variant === "error" ? "is-error" : ""}`}>
      <div className="message-text">{message.text}</div>
      {message.attachments && message.attachments.length > 0 ? (
        <div className="attachment-list">
          {message.attachments.map((attachment) => (
            <AttachmentCard
              key={`${attachment.type}:${attachment.documentId}:${"outputId" in attachment ? attachment.outputId : ""}`}
              activeDocumentId={activeDocumentId}
              attachment={attachment}
              output={"outputId" in attachment ? outputsById.get(attachment.outputId) : undefined}
              onPreview={onPreview}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AttachmentCard({
  attachment,
  activeDocumentId,
  output,
  onPreview
}: {
  attachment: ChatAttachment;
  activeDocumentId: string | null;
  output?: PdfOutput;
  onPreview: (documentId: string) => void;
}) {
  return (
    <div className={`attachment-card ${attachment.documentId === activeDocumentId ? "is-active" : ""}`}>
      <button className="attachment-main" onClick={() => onPreview(attachment.documentId)} title="Preview">
        <FileText size={16} />
        <span>{attachment.name}</span>
        <b aria-label={`${attachment.pageCount} pages`}>{attachment.pageCount}</b>
      </button>
      {attachment.type === "result" && output ? <DownloadAttachment output={output} /> : null}
    </div>
  );
}

function PendingAttachmentCard({
  document,
  isActive,
  onPreview,
  onRemove
}: {
  document: LocalPdfDocument;
  isActive: boolean;
  onPreview: () => void;
  onRemove: () => void;
}) {
  return (
    <div className={`pending-attachment ${isActive ? "is-active" : ""}`}>
      <button className="pending-main" type="button" onClick={onPreview} title="Preview">
        <FileText size={15} />
        <span>{document.name}</span>
        <b aria-label={`${document.pageCount} pages`}>{document.pageCount}</b>
      </button>
      <button className="pending-remove" type="button" onClick={onRemove} title="Remove" aria-label="Remove">
        <X size={14} />
      </button>
    </div>
  );
}

function DownloadAttachment({ output }: { output: PdfOutput }) {
  const url = useMemo(() => URL.createObjectURL(output.blob), [output.blob]);

  useEffect(() => {
    return () => URL.revokeObjectURL(url);
  }, [url]);

  return (
    <a className="attachment-download" href={url} download={output.name} title="Download" aria-label="Download">
      <Download size={15} />
    </a>
  );
}

function pdfAttachment(document: LocalPdfDocument): ChatAttachment {
  return {
    type: "pdf",
    documentId: document.id,
    name: document.name,
    pageCount: document.pageCount
  };
}

function resultAttachment(document: LocalPdfDocument, output: PdfOutput): ChatAttachment {
  return {
    type: "result",
    documentId: document.id,
    outputId: output.id,
    name: output.name,
    pageCount: document.pageCount
  };
}

async function parseCommand(
  message: string,
  documents: LocalPdfDocument[],
  activeDocument: LocalPdfDocument
): Promise<ParsedCommand> {
  const orderedDocuments = [
    activeDocument,
    ...documents.filter((document) => document.id !== activeDocument.id)
  ];
  const local = parseLocalCommand(message, orderedDocuments);
  if (local && local.tool !== "unsupported") {
    return { operation: local, source: "local" };
  }

  const response = await fetch("/api/parse-command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      documents: orderedDocuments.map((document) => ({
        id: document.id,
        name: document.name,
        pageCount: document.pageCount,
        pages: document.pages
      }))
    })
  });
  const data = (await response.json()) as ApiParseResponse;
  if (!data.ok) {
    if (local) return { operation: local, source: "local" };
    throw new Error(data.error);
  }
  return {
    operation: data.operation,
    source: data.source,
    remaining: data.remaining,
    limit: data.limit
  };
}

function sourceLabel(source: ParsedCommand["source"]): string {
  if (source === "local") return "Local";
  if (source === "ai-cache") return "Cache";
  return "AI";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
