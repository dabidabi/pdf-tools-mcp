import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FilePlus2, FileText, Loader2, MessageSquareText, RotateCw, Sparkles, Trash2 } from "lucide-react";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { parseLocalCommand } from "./lib/commandParser";
import { createDocumentFromBytes, loadPdfFile, runPdfOperation } from "./lib/pdfActions";
import type { ApiParseResponse, ChatMessage, LocalPdfDocument, ParsedCommand, PdfOutput } from "./lib/types";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export function App() {
  const [documents, setDocuments] = useState<LocalPdfDocument[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activePage, setActivePage] = useState(1);
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

  useEffect(() => {
    if (activeDocument && activePage > activeDocument.pageCount) {
      setActivePage(1);
    }
  }, [activeDocument, activePage]);

  async function handleFiles(files: FileList | File[]) {
    const pdfs = Array.from(files).filter((file) => /\.pdf$/i.test(file.name) || file.type === "application/pdf");
    if (pdfs.length === 0) return;

    setIsLoadingFiles(true);
    try {
      const loaded = await Promise.all(pdfs.map(loadPdfFile));
      setDocuments((current) => [...current, ...loaded]);
      setActiveId((current) => current ?? loaded[0]?.id ?? null);
      addAssistant(`${loaded.length} 个 PDF 已载入。`);
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
      addAssistant("请先上传 PDF。");
      return;
    }

    setIsRunning(true);
    try {
      const parsed = await parseCommand(text, documents);
      if (parsed.remaining !== undefined) setRemaining(parsed.remaining);
      const result = await runPdfOperation(parsed.operation, activeDocument, documents);
      addAssistant(`${sourceLabel(parsed.source)} ${result.message}`);

      if (result.outputs.length > 0) {
        setOutputs((current) => [...result.outputs, ...current]);
        const generated = await Promise.all(
          result.outputs.map((output) => createDocumentFromBytes(output.name, output.bytes))
        );
        setDocuments((current) => [...current, ...generated]);
        setActiveId(generated[0]?.id ?? activeDocument.id);
      }
    } catch (error) {
      addAssistant(errorMessage(error));
    } finally {
      setIsRunning(false);
    }
  }

  function addUser(text: string) {
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text }]);
  }

  function addAssistant(text: string) {
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text }]);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <FileText size={24} />
          <div>
            <h1>PDF Tools MCP</h1>
            <span>Web</span>
          </div>
        </div>

        <button className="primary-button" onClick={() => fileInputRef.current?.click()} disabled={isLoadingFiles}>
          {isLoadingFiles ? <Loader2 className="spin" size={18} /> : <FilePlus2 size={18} />}
          <span>添加 PDF</span>
        </button>
        <input
          ref={fileInputRef}
          className="sr-only"
          type="file"
          accept="application/pdf"
          multiple
          onChange={(event) => event.target.files && handleFiles(event.target.files)}
        />

        <div
          className="drop-zone"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            handleFiles(event.dataTransfer.files);
          }}
        >
          <FilePlus2 size={22} />
          <span>拖入 PDF</span>
        </div>

        <section className="panel-section">
          <h2>文件</h2>
          <div className="document-list">
            {documents.length === 0 ? (
              <div className="empty-line">暂无文件</div>
            ) : (
              documents.map((document) => (
                <button
                  key={document.id}
                  className={`document-item ${document.id === activeDocument?.id ? "is-active" : ""}`}
                  onClick={() => {
                    setActiveId(document.id);
                    setActivePage(1);
                  }}
                >
                  <FileText size={16} />
                  <span>{document.name}</span>
                  <b>{document.pageCount}</b>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="panel-section">
          <h2>结果</h2>
          <div className="output-list">
            {outputs.length === 0 ? (
              <div className="empty-line">暂无结果</div>
            ) : (
              outputs.map((output) => <DownloadOutput key={output.id} output={output} />)
            )}
          </div>
        </section>
      </aside>

      <section className="workspace">
        <div className="preview-toolbar">
          <div>
            <span>{activeDocument?.name ?? "未选择 PDF"}</span>
            {activeDocument ? <b>{activeDocument.pageCount} 页</b> : null}
          </div>
          <div className="quick-actions">
            <button
              title="查看信息"
              disabled={!activeDocument || isRunning}
              onClick={() => setPrompt("查看这个 PDF 的信息")}
            >
              <FileText size={17} />
            </button>
            <button
              title="旋转当前页"
              disabled={!activeDocument || isRunning}
              onClick={() => setPrompt(`旋转第 ${activePage} 页 90 度`)}
            >
              <RotateCw size={17} />
            </button>
            <button
              title="删除当前页"
              disabled={!activeDocument || isRunning}
              onClick={() => setPrompt(`删除第 ${activePage} 页`)}
            >
              <Trash2 size={17} />
            </button>
          </div>
        </div>

        <div className="preview-surface">
          {activeDocument ? (
            <PdfCanvas document={activeDocument} pageNumber={activePage} />
          ) : (
            <div className="empty-preview">
              <FileText size={64} />
              <span>PDF</span>
            </div>
          )}
        </div>

        <div className="page-strip" aria-label="Pages">
          {activeDocument?.pages.map((page) => (
            <button
              key={page.page}
              className={`page-chip ${page.page === activePage ? "is-active" : ""}`}
              onClick={() => setActivePage(page.page)}
            >
              {page.page}
            </button>
          ))}
        </div>
      </section>

      <aside className="chat-panel">
        <div className="chat-header">
          <div>
            <MessageSquareText size={20} />
            <h2>对话</h2>
          </div>
          <span>{remaining === null ? "AI 10/天" : `AI 剩余 ${remaining}`}</span>
        </div>

        <div className="messages">
          {messages.length === 0 ? (
            <div className="empty-chat">
              <Sparkles size={28} />
              <span>等待指令</span>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className={`message ${message.role}`}>
                {message.text}
              </div>
            ))
          )}
        </div>

        <form className="composer" onSubmit={handleSubmit}>
          <textarea
            value={prompt}
            placeholder="删除第 2 页，提取 1-3 页，合并全部..."
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button className="send-button" type="submit" disabled={isRunning || !prompt.trim()}>
            {isRunning ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
            <span>运行</span>
          </button>
        </form>
      </aside>
    </main>
  );
}

function PdfCanvas({ document, pageNumber }: { document: LocalPdfDocument; pageNumber: number }) {
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
        const availableHeight = Math.max(canvas.parentElement?.clientHeight ?? 720, 320) - 48;
        const scale = Math.min(availableWidth / baseViewport.width, availableHeight / baseViewport.height, 1.8);
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

function DownloadOutput({ output }: { output: PdfOutput }) {
  const url = useMemo(() => URL.createObjectURL(output.blob), [output.blob]);

  useEffect(() => {
    return () => URL.revokeObjectURL(url);
  }, [url]);

  return (
    <a className="output-item" href={url} download={output.name}>
      <Download size={15} />
      <span>{output.name}</span>
    </a>
  );
}

async function parseCommand(message: string, documents: LocalPdfDocument[]): Promise<ParsedCommand> {
  const local = parseLocalCommand(message, documents);
  if (local && local.tool !== "unsupported") {
    return { operation: local, source: "local" };
  }

  const response = await fetch("/api/parse-command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      documents: documents.map((document) => ({
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
  if (source === "local") return "本地解析：";
  if (source === "ai-cache") return "缓存解析：";
  return "AI 解析：";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
