import * as React from "react";
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@honocube/ui";
import type { RichTextEditorProps, RichTextToolbarTool } from "@honocube/core";

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  id,
  name,
  value,
  onChange,
  disabled = false,
  readOnly = false,
  placeholder = "Write something formatted...",
  toolbar = [
    "headings",
    "bold",
    "italic",
    "underline",
    "strike",
    "bulletList",
    "orderedList",
    "blockquote",
    "codeBlock",
    "link",
    "clear",
  ],
  minHeight = 180,
  maxHeight,
  hasError = false,
  className = "",
}) => {
  const editorRef = React.useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = React.useState<"visual" | "source">("visual");
  const [internalHtml, setInternalHtml] = React.useState(value ?? "");

  // Sync internal state when external value changes
  React.useEffect(() => {
    if (value !== undefined && value !== null && value !== internalHtml) {
      setInternalHtml(value);
      if (editorRef.current && editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value;
      }
    }
  }, [value, internalHtml]);

  // Handle visual editor input
  const handleEditorInput = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    setInternalHtml(html);
    onChange(html);
  };

  // Execute formatting command on selection
  const executeCommand = (command: string, arg?: string) => {
    if (disabled || readOnly) return;
    if (typeof document !== "undefined") {
      document.execCommand(command, false, arg);
      handleEditorInput();
      if (editorRef.current) {
        editorRef.current.focus();
      }
    }
  };

  const handleInsertLink = () => {
    if (typeof window !== "undefined") {
      const url = window.prompt("Enter URL:", "https://");
      if (url) {
        executeCommand("createLink", url);
      }
    }
  };

  // Word and character statistics
  const { wordCount, charCount } = React.useMemo(() => {
    const text = internalHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const chars = text.length;
    const words = text.length === 0 ? 0 : text.split(" ").filter(Boolean).length;
    return { wordCount: words, charCount: chars };
  }, [internalHtml]);

  const hasTool = (tool: RichTextToolbarTool) => toolbar.includes(tool);

  // Read-only presentation mode
  if (readOnly || disabled) {
    return (
      <div
        className={`rounded-lg border bg-muted/20 p-4 prose prose-sm dark:prose-invert max-w-none ${className}`}
        style={{ minHeight: `${minHeight}px` }}
        dangerouslySetInnerHTML={{ __html: value || `<p class="text-muted-foreground">${placeholder}</p>` }}
      />
    );
  }

  return (
    <div
      className={`rounded-lg border bg-background overflow-hidden flex flex-col focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1 transition-all ${
        hasError ? "border-destructive ring-1 ring-destructive" : "border-border"
      } ${className}`}
    >
      {/* Formatting Toolbar */}
      <div className="bg-muted/40 border-b border-border p-1.5 flex flex-wrap items-center gap-1 select-none">
        {hasTool("headings") && (
          <div className="w-[110px] shrink-0">
            <Select
              defaultValue="p"
              onValueChange={(val) => {
                if (val === "p") {
                  executeCommand("formatBlock", "<p>");
                } else {
                  executeCommand("formatBlock", `<${val}>`);
                }
              }}
            >
              <SelectTrigger className="h-7 text-xs bg-background px-2">
                <SelectValue placeholder="Heading" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="p" className="text-xs">Normal text</SelectItem>
                <SelectItem value="h1" className="text-xs font-bold">Heading 1</SelectItem>
                <SelectItem value="h2" className="text-xs font-semibold">Heading 2</SelectItem>
                <SelectItem value="h3" className="text-xs font-medium">Heading 3</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="h-4 w-px bg-border mx-0.5" />

        {hasTool("bold") && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => executeCommand("bold")}
            className="h-7 w-7 p-0 font-bold text-xs"
            title="Bold (Ctrl+B)"
          >
            B
          </Button>
        )}

        {hasTool("italic") && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => executeCommand("italic")}
            className="h-7 w-7 p-0 italic text-xs font-serif"
            title="Italic (Ctrl+I)"
          >
            I
          </Button>
        )}

        {hasTool("underline") && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => executeCommand("underline")}
            className="h-7 w-7 p-0 underline text-xs"
            title="Underline (Ctrl+U)"
          >
            U
          </Button>
        )}

        {hasTool("strike") && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => executeCommand("strikeThrough")}
            className="h-7 w-7 p-0 line-through text-xs"
            title="Strikethrough"
          >
            S
          </Button>
        )}

        <div className="h-4 w-px bg-border mx-0.5" />

        {hasTool("bulletList") && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => executeCommand("insertUnorderedList")}
            className="h-7 px-1.5 text-xs"
            title="Bullet List"
          >
            • List
          </Button>
        )}

        {hasTool("orderedList") && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => executeCommand("insertOrderedList")}
            className="h-7 px-1.5 text-xs"
            title="Numbered List"
          >
            1. List
          </Button>
        )}

        {hasTool("blockquote") && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => executeCommand("formatBlock", "<blockquote>")}
            className="h-7 px-1.5 text-xs font-serif"
            title="Quote"
          >
            &ldquo;Quote
          </Button>
        )}

        {hasTool("codeBlock") && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => executeCommand("formatBlock", "<pre>")}
            className="h-7 px-1.5 text-xs font-mono"
            title="Code Block"
          >
            &lt;/&gt;
          </Button>
        )}

        <div className="h-4 w-px bg-border mx-0.5" />

        {hasTool("link") && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleInsertLink}
            className="h-7 px-1.5 text-xs"
            title="Insert Link"
          >
            Link
          </Button>
        )}

        {hasTool("clear") && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => executeCommand("removeFormat")}
            className="h-7 px-1.5 text-xs text-muted-foreground hover:text-foreground"
            title="Clear Formatting"
          >
            Clear
          </Button>
        )}

        <div className="flex-1" />

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 border border-border rounded p-0.5 bg-background">
          <Button
            type="button"
            variant={mode === "visual" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setMode("visual")}
            className="h-6 px-2 text-[11px]"
          >
            Visual
          </Button>
          <Button
            type="button"
            variant={mode === "source" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setMode("source")}
            className="h-6 px-2 text-[11px]"
          >
            HTML
          </Button>
        </div>
      </div>

      {/* Editor Body */}
      {mode === "visual" ? (
        <div
          ref={editorRef}
          id={id || name}
          contentEditable={!disabled && !readOnly}
          onInput={handleEditorInput}
          dangerouslySetInnerHTML={{ __html: value ?? "" }}
          className="p-4 outline-none overflow-y-auto prose prose-sm dark:prose-invert max-w-none text-foreground flex-1 cursor-text empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground empty:before:pointer-events-none"
          data-placeholder={placeholder}
          style={{
            minHeight: `${minHeight}px`,
            maxHeight: maxHeight ? `${maxHeight}px` : undefined,
          }}
          role="textbox"
          aria-multiline="true"
          aria-label={placeholder}
        />
      ) : (
        <textarea
          value={internalHtml}
          onChange={(e) => {
            const next = e.target.value;
            setInternalHtml(next);
            onChange(next);
          }}
          className="p-4 outline-none resize-none font-mono text-xs bg-muted/10 text-foreground flex-1"
          style={{
            minHeight: `${minHeight}px`,
            maxHeight: maxHeight ? `${maxHeight}px` : undefined,
          }}
          aria-label="HTML source editor"
        />
      )}

      {/* Footer Word/Character Counter */}
      <div className="bg-muted/20 border-t border-border px-3 py-1 flex items-center justify-between text-[11px] text-muted-foreground select-none">
        <span>{mode === "visual" ? "WYSIWYG Rich Editor" : "Raw HTML Mode"}</span>
        <span>
          {wordCount} {wordCount === 1 ? "word" : "words"} &middot; {charCount} chars
        </span>
      </div>
    </div>
  );
};

RichTextEditor.displayName = "RichTextEditor";
