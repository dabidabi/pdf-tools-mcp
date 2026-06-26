import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  FileText,
  Files,
  Loader2,
  MessageSquareText,
  Plus,
  SendHorizontal,
  Sparkles
} from "lucide-react";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { parseLocalCommand } from "./lib/commandParser";
import { createDocumentFromBytes, loadPdfFile, runPdfOperation } from "./lib/pdfActions";
import type { ApiParseResponse, ChatAttachment, ChatMessage, LocalPdfDocument, ParsedCommand, PdfOutput } from "./lib/types";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export function App() {
  const [documents, setDocuments] = useState<LocalPdfDocument[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<PdfOutput[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeDocument = useMemo(
    () => documents.find((document) => document.id === activeId) ?? documents[0] ?? null,
    [activeId, documents]
  );

  const outputsById = useMemo(() => new Map(outputs.map((output) => [output.id, output])), [outputs]);

  async function handleFiles(files: FileList | File[]) {
    const pdfs = Array.from(files).filter((file) => /\.pdf$/i.test(file.name) || file.type === "application/pdf");
    if (pdfs.length === 0) return;

    setIsLoadingFiles(true);
    try {
      const loaded = await Promise.all(pdfs.map(loadPdfFile));
      setDocuments((current) => [...current, ...loaded]);
      setActiveId(loaded[0]?.id ?? activeDocument?.id ?? null);
      addUser("PDF", loaded.map(pdfAttachment));
    } catch (error) {
      addAssistant(errorMessage(error));
    } finally {
      setIsLoadingFiles(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const text = prompt.trim();
    if (!text || isRunning) return;

    addUser(text);
    setPrompt("");

    if (!activeDocument) {
      addAssistant("Add a PDF first.");
      return;
    }

    setIsRunning(true);
    try {
      const parsed = await parseCommand(text, documents, activeDocument);
      if (parsed.remaining !== undefined) setRemaining(parsed.remaining);
      const result = await runPdfOperation(parsed.operation, activeDocument, documents);

      if (result.outputs.length > 0) {
        setOutputs((current) => [...result.outputs, ...current]);
        const generated = await Promise.all(
          result.outputs.map((output) => createDocumentFromBytes(output.name, output.bytes))
        );
        setDocuments((current) => [...current, ...generated]);
        setActiveId(generated[0]?.id ?? activeDocument.id);
        addAssistant(
          `${sourceLabel(parsed.source)} · ${result.message}`,
          generated.map((document, index) => resultAttachment(document, result.outputs[index]))
        );
      } else {
        addAssistant(`${sourceLabel(parsed.source)} · ${result.message}`);
      }
    } catch (error) {
      addAssistant(errorMessage(error));
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

  function addUser(text: string, attachments?: ChatAttachment[]) {
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text, attachments }]);
  }

  function addAssistant(text: string, attachments?: ChatAttachment[]) {
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text, attachments }]);
  }

  return (
    <main
      className="app-shell"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        handleFiles(event.dataTransfer.files);
      }}
      onPaste={handlePaste}
    >
      <section className="workspace">
        <div className="preview-toolbar">
          <div className="document-chip" title={activeDocument?.name ?? "PDF"}>
            <FileText size={18} />
            <span>{activeDocument?.name ?? "PDF"}</span>
            {activeDocument ? <b aria-label={`${activeDocument.pageCount} pages`}>{activeDocument.pageCount}</b> : null}
          </div>
        </div>

        <div className="preview-surface">
          {activeDocument ? (
            <PdfScrollView document={activeDocument} />
          ) : (
            <div className="empty-preview">
              <FileText size={64} />
              <Plus size={24} />
            </div>
          )}
        </div>
      </section>

      <aside className="chat-panel">
        <div className="chat-header">
          <div className="brand">
            <MessageSquareText size={22} />
            <div className="quota-pill" title="AI quota">
              <Sparkles size={15} />
              <span>{remaining ?? 10}</span>
            </div>
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

        <div className="messages">
          {messages.length === 0 && documents.length === 0 ? (
            <div className="empty-chat">
              <Files size={30} />
              <MessageSquareText size={28} />
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
        </div>

        <form className="composer" onSubmit={handleSubmit}>
          <button
            className="composer-upload"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoadingFiles}
            title="Add PDF"
            aria-label="Add PDF"
          >
            {isLoadingFiles ? <Loader2 className="spin" size={18} /> : <Plus size={20} />}
          </button>
          <textarea
            value={prompt}
            placeholder="Ask PDF..."
            aria-label="PDF command"
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
            {isRunning ? <Loader2 className="spin" size={18} /> : <SendHorizontal size={18} />}
          </button>
        </form>
      </aside>
    </main>
  );
}

function PdfScrollView({ document }: { document: LocalPdfDocument }) {
  return (
    <div className="pdf-scroll">
      {document.pages.map((page) => (
        <div className="pdf-page" key={page.page}>
          <div className="pdf-page-label">{page.page}</div>
          <PdfPageCanvas document={document} pageNumber={page.page} />
        </div>
      ))}
    </div>
  );
}

function PdfPageCanvas({ document, pageNumber }: { document: LocalPdfDocument; pageNumber: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      setError(null);

      try {
        const loadingTask = getDocument({ data: new Uint8Array(document.bytes) });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        const availableWidth = Math.max(canvas.parentElement?.clientWidth ?? 720, 320) - 48;
        const scale = Math.min(availableWidth / baseViewport.width, 1.7);
        const viewport = page.getViewport({ scale });
        const context = canvas.getContext("2d");
        if (!context || cancelled) return;

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        context.clearRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: context, viewport }).promise;
        await pdf.destroy();
      } catch (renderError) {
        if (!cancelled) setError(errorMessage(renderError));
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [document, pageNumber]);

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
    <div className={`message ${message.role}`}>
      <div>{message.text}</div>
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
        <FileText size={17} />
        <span>{attachment.name}</span>
        <b aria-label={`${attachment.pageCount} pages`}>{attachment.pageCount}</b>
      </button>
      {attachment.type === "result" && output ? <DownloadAttachment output={output} /> : null}
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
    remaining: data.remaining
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
