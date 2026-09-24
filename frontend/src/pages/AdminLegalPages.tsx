import { useEffect, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import type { LegalPage, LegalPagesResponse } from '@lp-tracker/contracts';
import AdminToastHost, { type AdminToastMessage } from '../components/AdminToastHost';

function Editor({
  page,
  onSaved,
  onError,
}: {
  page: LegalPage;
  onSaved: (page: LegalPage) => void;
  onError: (message: string) => void;
}) {
  const [title, setTitle] = useState(page.title);
  const [html, setHtml] = useState(page.contentHtml);
  const [published, setPublished] = useState(page.published);
  const [busy, setBusy] = useState(false);
  const [editorFocused, setEditorFocused] = useState(false);
  const editor = useEditor({
    extensions: [StarterKit, Link.configure({ openOnClick: false })],
    content: page.contentHtml,
    onUpdate: ({ editor: current }) => setHtml(current.getHTML()),
    onFocus: () => setEditorFocused(true),
    onBlur: () => setEditorFocused(false),
  });
  const editorState = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive('bold'),
      italic: current.isActive('italic'),
      h1: current.isActive('heading', { level: 1 }),
      h2: current.isActive('heading', { level: 2 }),
      h3: current.isActive('heading', { level: 3 }),
      bulletList: current.isActive('bulletList'),
      orderedList: current.isActive('orderedList'),
      blockquote: current.isActive('blockquote'),
      link: current.isActive('link'),
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
    }),
  });
  const save = async () => {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/legal-pages/${page.slug}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, contentHtml: html, published }),
      });
      if (!response.ok) {
        throw new Error('Saving failed');
      }
      onSaved(((await response.json()) as { page: LegalPage }).page);
    } catch {
      onError('Could not save legal page.');
    } finally {
      setBusy(false);
    }
  };
  if (!editor) return null;
  return (
    <div className="admin-legal-editor">
      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <div className="admin-legal-toolbar">
        <div className="admin-legal-toolbar-formatting">
          <button
            type="button"
            aria-label="Bold"
            title="Bold"
            className={editorFocused && editorState.bold ? 'is-active' : ''}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            aria-label="Italic"
            title="Italic"
            className={editorFocused && editorState.italic ? 'is-active' : ''}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <em>I</em>
          </button>
          <button
            type="button"
            className={editorFocused && editorState.h1 ? 'is-active' : ''}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          >
            H1
          </button>
          <button
            type="button"
            className={editorFocused && editorState.h2 ? 'is-active' : ''}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            H2
          </button>
          <button
            type="button"
            className={editorFocused && editorState.h3 ? 'is-active' : ''}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          >
            H3
          </button>
          <button
            type="button"
            className={editorFocused && editorState.bulletList ? 'is-active' : ''}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            • List
          </button>
          <button
            type="button"
            className={editorFocused && editorState.orderedList ? 'is-active' : ''}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            1. List
          </button>
          <button
            type="button"
            className={editorFocused && editorState.blockquote ? 'is-active' : ''}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            Quote
          </button>
          <button
            type="button"
            className={editorFocused && editorState.link ? 'is-active' : ''}
            onClick={() => {
              const href = window.prompt('Link URL');

              if (href) {
                editor.chain().focus().setLink({ href }).run();
              }
            }}
          >
            Link
          </button>
          <button type="button" onClick={() => editor.chain().focus().unsetLink().run()}>
            Unlink
          </button>
        </div>
        <div className="admin-legal-toolbar-history">
          <button
            className="admin-legal-history-button"
            type="button"
            aria-label="Undo"
            title="Undo"
            disabled={!editorState.canUndo}
            onClick={() => editor.chain().focus().undo().run()}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M9 7H5V3M5 7C7.1 4.9 9.6 4 12 4C16.4 4 20 7.6 20 12C20 16.4 16.4 20 12 20C8.7 20 5.9 18 4.7 15.2"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            className="admin-legal-history-button"
            type="button"
            aria-label="Redo"
            title="Redo"
            disabled={!editorState.canRedo}
            onClick={() => editor.chain().focus().redo().run()}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M15 7H19V3M19 7C16.9 4.9 14.4 4 12 4C7.6 4 4 7.6 4 12C4 16.4 7.6 20 12 20C15.3 20 18.1 18 19.3 15.2"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
      <EditorContent editor={editor} className="admin-legal-editable" />
      <label className="admin-legal-published">
        <input
          type="checkbox"
          checked={published}
          onChange={(e) => setPublished(e.target.checked)}
        />{' '}
        Published publicly
      </label>
      <button
        className="admin-primary-button"
        type="button"
        disabled={busy}
        onClick={() => void save()}
      >
        {busy ? 'SAVING...' : 'SAVE PAGE'}
      </button>
    </div>
  );
}
export default function AdminLegalPages() {
  const [pages, setPages] = useState<LegalPage[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [toasts, setToasts] = useState<AdminToastMessage[]>([]);
  useEffect(() => {
    void fetch('/api/admin/legal-pages', { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return (await response.json()) as LegalPagesResponse;
      })
      .then((data) => {
        setPages(data.pages);
        setSelected(data.pages[0]?.slug ?? null);
      })
      .catch(() => {
        setToasts([
          {
            id: String(Date.now()),
            variant: 'error',
            message: 'Could not load legal pages.',
          },
        ]);
      });
  }, []);
  const page = pages.find((entry) => entry.slug === selected);
  return (
    <section className="admin-section admin-legal-section">
      <div className="admin-section-header">
        <div>
          <span className="admin-section-eyebrow">PUBLIC PAGES</span>
          <h2>Privacy and Imprint</h2>
          <p>
            Edit the legal pages for this installation. Published content is visible to the public.
          </p>
        </div>
      </div>
      <div className="admin-legal-tabs">
        {pages.map((entry) => (
          <button
            type="button"
            key={entry.slug}
            className={entry.slug === selected ? 'is-active' : ''}
            onClick={() => setSelected(entry.slug)}
          >
            {entry.title}
          </button>
        ))}
      </div>
      {page ? (
        <Editor
          key={page.slug + page.updatedAt}
          page={page}
          onSaved={(updated) => {
            setPages((current) =>
              current.map((entry) => (entry.slug === updated.slug ? updated : entry)),
            );
            setToasts([{ id: String(Date.now()), variant: 'success', message: 'Page saved.' }]);
          }}
          onError={(message) => {
            setToasts([{ id: String(Date.now()), variant: 'error', message }]);
          }}
        />
      ) : (
        <p>No pages loaded.</p>
      )}
      <AdminToastHost
        toasts={toasts}
        onDismiss={(id) => setToasts((current) => current.filter((entry) => entry.id !== id))}
      />
    </section>
  );
}
