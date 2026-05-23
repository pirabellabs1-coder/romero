"use client";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useState } from "react";
import { promptDialog } from "@/components/ui/Modal";

type Props = {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  minHeight?: number;
};

export default function RichEditor({ name, defaultValue = "", placeholder = "Commencez à écrire…", minHeight = 260 }: Props) {
  const [html, setHtml] = useState(defaultValue);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Image.configure({ inline: false }),
      Placeholder.configure({ placeholder }),
    ],
    content: defaultValue || "",
    editorProps: {
      attributes: {
        class: "rich-editor-content",
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor }) => setHtml(editor.getHTML()),
    immediatelyRender: false,
  });

  // Sync html state if defaultValue changes (e.g. form re-mount after save)
  useEffect(() => {
    if (editor && defaultValue !== editor.getHTML()) {
      editor.commands.setContent(defaultValue || "", { emitUpdate: false });
      setHtml(defaultValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValue]);

  if (!editor) {
    return (
      <div className="rich-editor-shell" style={{ minHeight }}>
        <div className="rich-toolbar" />
        <div className="rich-editor-content" style={{ minHeight, padding: 14, color: "var(--muted)", fontStyle: "italic" }}>
          Chargement de l&apos;éditeur…
        </div>
        <input type="hidden" name={name} value={defaultValue} />
      </div>
    );
  }

  return (
    <div className="rich-editor-shell">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} style={{ minHeight }} />
      <input type="hidden" name={name} value={html} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const btn = (active: boolean, onClick: () => void, label: string, title: string) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rich-btn ${active ? "is-active" : ""}`}
    >
      {label}
    </button>
  );

  const addLink = async () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = await promptDialog({
      title: "Insérer un lien",
      message: "Saisissez l'URL du lien. Laissez vide pour retirer le lien existant.",
      defaultValue: prev || "https://",
      placeholder: "https://exemple.com",
      inputType: "url",
      confirmLabel: prev ? "Mettre à jour" : "Insérer",
    });
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const addImage = async () => {
    const url = await promptDialog({
      title: "Insérer une image",
      message: "Collez l'URL de l'image (par exemple : /uploads/galleries/g2-manon-kevin/photo.webp).",
      defaultValue: "/uploads/",
      placeholder: "/uploads/...",
      inputType: "url",
      confirmLabel: "Insérer",
    });
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  };

  return (
    <div className="rich-toolbar">
      {btn(editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), "B", "Gras")}
      {btn(editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), "i", "Italique")}
      {btn(editor.isActive("strike"), () => editor.chain().focus().toggleStrike().run(), "S", "Barré")}
      <span className="rich-sep" />
      {btn(editor.isActive("heading", { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), "H2", "Titre H2")}
      {btn(editor.isActive("heading", { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), "H3", "Titre H3")}
      {btn(editor.isActive("paragraph"), () => editor.chain().focus().setParagraph().run(), "¶", "Paragraphe")}
      <span className="rich-sep" />
      {btn(editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), "• Liste", "Liste à puces")}
      {btn(editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), "1. Liste", "Liste numérotée")}
      {btn(editor.isActive("blockquote"), () => editor.chain().focus().toggleBlockquote().run(), "❝", "Citation")}
      <span className="rich-sep" />
      {btn(editor.isActive("link"), addLink, "Lien", "Insérer un lien")}
      {btn(false, addImage, "🖼", "Insérer une image (URL)")}
      <span className="rich-sep" />
      <button type="button" className="rich-btn" title="Annuler" onClick={() => editor.chain().focus().undo().run()}>↶</button>
      <button type="button" className="rich-btn" title="Refaire" onClick={() => editor.chain().focus().redo().run()}>↷</button>
    </div>
  );
}
