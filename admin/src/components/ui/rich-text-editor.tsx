"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "./cn";
import { CONTROL } from "./field";

/**
 * A small rich-text editor for page bodies, news and events.
 *
 * Deliberately modest: paragraphs, two heading sizes, bold, italic, lists,
 * quotes and links — the vocabulary the website's rich-text renderer styles.
 * Anything pasted in beyond that is dropped by the sanitiser on save and
 * again on render, so this control does not have to be the last line of
 * defence; it only has to make the ordinary cases easy.
 *
 * Built on contentEditable and the browser's own editing commands, which
 * every browser still ships, rather than a third-party editor: nothing to
 * keep patched, and the output is plain HTML.
 *
 * The HTML travels in a hidden field, so the surrounding form posts it like
 * any other value.
 */

type Command =
  | { kind: "block"; tag: "p" | "h2" | "h3" | "blockquote"; label: string; title: string }
  | { kind: "inline"; command: "bold" | "italic" | "insertUnorderedList" | "insertOrderedList"; label: ReactNode; title: string }
  | { kind: "link"; label: string; title: string }
  | { kind: "unlink"; label: string; title: string }
  | { kind: "image"; label: string; title: string }
  | { kind: "table"; label: string; title: string }
  | { kind: "clear"; label: string; title: string };

/** An image the editor may insert — the admin passes its media library in. */
export type EditorImage = {
  src: string;
  alt: string;
  label: string;
};

const TOOLBAR: Command[][] = [
  [
    { kind: "block", tag: "p", label: "Text", title: "Paragraph" },
    { kind: "block", tag: "h2", label: "H2", title: "Heading" },
    { kind: "block", tag: "h3", label: "H3", title: "Sub-heading" },
    { kind: "block", tag: "blockquote", label: "“ ”", title: "Quote" },
  ],
  [
    { kind: "inline", command: "bold", label: <strong>B</strong>, title: "Bold" },
    { kind: "inline", command: "italic", label: <em>I</em>, title: "Italic" },
  ],
  [
    { kind: "inline", command: "insertUnorderedList", label: "• List", title: "Bullet list" },
    { kind: "inline", command: "insertOrderedList", label: "1. List", title: "Numbered list" },
  ],
  [
    { kind: "link", label: "Link", title: "Add a link" },
    { kind: "unlink", label: "Unlink", title: "Remove the link" },
  ],
  [
    { kind: "image", label: "Image", title: "Insert an image" },
    { kind: "table", label: "Table", title: "Insert a table" },
  ],
  [{ kind: "clear", label: "Clear", title: "Remove formatting" }],
];

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/**
 * A 3×3 starter table with a header row. Cells hold a non-breaking space so
 * the caret has somewhere to land; the sanitiser and renderer both already
 * understand this exact markup.
 */
const TABLE_HTML =
  "<table><thead><tr><th>Heading</th><th>Heading</th><th>Heading</th></tr></thead>" +
  "<tbody>" +
  "<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>".repeat(2) +
  "</tbody></table><p><br></p>";

export function RichTextEditor({
  id,
  name,
  defaultValue = "",
  placeholder = "Start writing…",
  minHeightClass = "min-h-64",
  "aria-labelledby": labelledBy,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  images = [],
}: {
  id: string;
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  minHeightClass?: string;
  /**
   * A div[role=textbox] is not labelable, so the label cannot reach it via
   * htmlFor; Field passes its label's id here instead. Without it the editor
   * has no accessible name and a screen reader announces only "edit text".
   */
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  /** Accepted from Field's render props; a hidden input cannot enforce it. */
  required?: boolean;
  /** Images offered by the Image button. With none, the button is not shown. */
  images?: EditorImage[];
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [imageFilter, setImageFilter] = useState("");
  const editorRef = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState(defaultValue ?? "");
  const [empty, setEmpty] = useState(!(defaultValue ?? "").replace(/<[^>]+>/g, "").trim());

  // The initial HTML is set once, imperatively: React must not re-render the
  // editable's children while the user is typing in it.
  useEffect(() => {
    if (editorRef.current && defaultValue) editorRef.current.innerHTML = defaultValue;
    // Enter makes a paragraph, not a <div>; bold and italic make the semantic
    // tags. Both are document-wide settings, harmless to repeat.
    document.execCommand("defaultParagraphSeparator", false, "p");
    document.execCommand("styleWithCSS", false, "false");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function sync() {
    const element = editorRef.current;
    if (!element) return;
    // Chrome still writes <b>/<i> for its commands; store the semantic tags.
    const cleaned = element.innerHTML
      .replace(/<(\/?)b(\s|>)/g, "<$1strong$2")
      .replace(/<(\/?)i(\s|>)/g, "<$1em$2");
    setHtml(cleaned);
    setEmpty(!element.textContent?.trim());
  }

  function run(command: Command) {
    editorRef.current?.focus();
    switch (command.kind) {
      case "block":
        document.execCommand("formatBlock", false, command.tag);
        break;
      case "inline":
        document.execCommand(command.command, false);
        break;
      case "link": {
        const selection = window.getSelection();
        const current = selection?.anchorNode?.parentElement?.closest("a")?.getAttribute("href") ?? "";
        const href = window.prompt("Link address (a page like /admissions, or https://…)", current || "https://");
        if (href === null) return;
        const trimmed = href.trim();
        if (!trimmed || !/^(\/|https?:\/\/|mailto:|tel:)/.test(trimmed)) return;
        if (selection && selection.isCollapsed) {
          // Nothing selected: insert the address as the link text.
          document.execCommand("insertHTML", false, `<a href="${trimmed.replace(/"/g, "&quot;")}">${trimmed}</a>`);
        } else {
          document.execCommand("createLink", false, trimmed);
        }
        break;
      }
      case "unlink":
        document.execCommand("unlink", false);
        break;
      case "image":
        // The picker is rendered inline rather than as a prompt, so the
        // selection stays where it was; mousedown on the picker is swallowed
        // for the same reason the toolbar swallows it.
        setPickerOpen((open) => !open);
        return;
      case "table":
        document.execCommand("insertHTML", false, TABLE_HTML);
        break;
      case "clear":
        document.execCommand("removeFormat", false);
        document.execCommand("formatBlock", false, "p");
        break;
    }
    sync();
  }

  function insertImage(image: EditorImage) {
    editorRef.current?.focus();
    document.execCommand(
      "insertHTML",
      false,
      `<figure><img src="${escapeAttribute(image.src)}" alt="${escapeAttribute(image.alt)}" loading="lazy">` +
        `<figcaption>${escapeAttribute(image.alt || image.label)}</figcaption></figure><p><br></p>`,
    );
    setPickerOpen(false);
    setImageFilter("");
    sync();
  }

  const visibleImages = images.filter((image) =>
    `${image.label} ${image.alt}`.toLowerCase().includes(imageFilter.trim().toLowerCase()),
  );

  return (
    <div
      className={cn(
        "overflow-hidden rounded-card border border-line-strong bg-surface-raised focus-within:border-navy-600 focus-within:ring-2 focus-within:ring-navy-600/25",
        invalid && "border-danger-600",
      )}
    >
      <input type="hidden" name={name} value={html} />

      <div role="toolbar" aria-label="Formatting" className="flex flex-wrap gap-x-3 gap-y-1 border-b border-line bg-surface-sunken/70 px-2 py-1.5">
        {TOOLBAR.map((group, index) => (
          <div key={index} className="flex gap-0.5">
            {group
              .filter((command) => command.kind !== "image" || images.length > 0)
              .map((command) => (
              <button
                key={command.title}
                type="button"
                title={command.title}
                aria-label={command.title}
                // mousedown would steal the selection from the editable.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => run(command)}
                aria-expanded={command.kind === "image" ? pickerOpen : undefined}
                className={cn(
                  "rounded px-2 py-1 text-sm text-navy-800 hover:bg-navy-50",
                  command.kind === "image" && pickerOpen && "bg-navy-50",
                )}
              >
                {command.label}
              </button>
            ))}
          </div>
        ))}
      </div>

      {pickerOpen ? (
        <div
          role="region"
          aria-label="Choose an image"
          onMouseDown={(event) => event.preventDefault()}
          className="border-b border-line bg-surface-sunken/40 p-3"
        >
          <div className="mb-3 flex items-center gap-2">
            <input
              type="search"
              value={imageFilter}
              onChange={(event) => setImageFilter(event.target.value)}
              placeholder="Filter images"
              aria-label="Filter images"
              className="h-9 flex-1 rounded border border-line bg-white px-3 text-sm"
            />
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              className="h-9 rounded px-3 text-sm text-ink-600 hover:bg-navy-50"
            >
              Cancel
            </button>
          </div>
          {visibleImages.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-500">No images match.</p>
          ) : (
            <ul className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 md:grid-cols-6">
              {visibleImages.slice(0, 48).map((image) => (
                <li key={image.src}>
                  <button
                    type="button"
                    onClick={() => insertImage(image)}
                    title={image.label}
                    className="group block w-full overflow-hidden rounded border border-line bg-white text-left focus-visible:ring-2 focus-visible:ring-navy-600"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail inside an editor; next/image is not needed here */}
                    <img src={image.src} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                    <span className="block truncate px-1.5 py-1 text-[0.6875rem] text-ink-600 group-hover:text-navy-900">
                      {image.label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <div className="relative">
        {empty ? (
          <span aria-hidden="true" className="pointer-events-none absolute left-3.5 top-3 text-[0.9375rem] text-ink-500">
            {placeholder}
          </span>
        ) : null}
        <div
          ref={editorRef}
          id={id}
          role="textbox"
          aria-multiline="true"
          aria-labelledby={labelledBy}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          contentEditable
          suppressContentEditableWarning
          onInput={sync}
          onBlur={sync}
          onPaste={(event) => {
            // Paste as plain text; the sanitiser would strip most pasted
            // markup anyway, and this avoids Word's clutter reaching the DOM.
            event.preventDefault();
            const text = event.clipboardData.getData("text/plain");
            document.execCommand("insertText", false, text);
          }}
          className={cn(
            CONTROL,
            "prose-editor rounded-none border-0 focus:ring-0",
            minHeightClass,
            "[&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:text-lg [&_h3]:font-semibold",
            "[&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6",
            "[&_blockquote]:my-2 [&_blockquote]:border-l-4 [&_blockquote]:border-gold-400 [&_blockquote]:pl-4 [&_blockquote]:italic",
            "[&_a]:text-navy-700 [&_a]:underline",
          )}
        />
      </div>
    </div>
  );
}
