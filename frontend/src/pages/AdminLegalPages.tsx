import { useEffect, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import type { LegalPage } from '@lp-tracker/contracts';
import AdminToastHost, { type AdminToastMessage } from '../components/AdminToastHost';

function Editor({ page, onSaved }: { page: LegalPage; onSaved: (page: LegalPage) => void }) {
  const [title, setTitle] = useState(page.title);
  const [html, setHtml] = useState(page.contentHtml);
  const [published, setPublished] = useState(page.published);
  const [busy, setBusy] = useState(false);
  const editor = useEditor({
    extensions: [StarterKit, Link.configure({ openOnClick: false })],
    content: page.contentHtml,
    onUpdate: ({ editor: current }) => setHtml(current.getHTML()),
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
      if (!response.ok) throw new Error('Saving failed');
      onSaved(((await response.json()) as { page: LegalPage }).page);
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
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()}>
          <strong>B</strong>
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()}>
          <em>I</em>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H3
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()}>
          • List
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          1. List
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          Quote
        </button>
        <button
          type="button"
          onClick={() => {
            const href = window.prompt('Link URL');
            if (href) editor.chain().focus().setLink({ href }).run();
          }}
        >
          Link
        </button>
        <button type="button" onClick={() => editor.chain().focus().unsetLink().run()}>
          Unlink
        </button>
        <button type="button" onClick={() => editor.chain().focus().undo().run()}>
          Undo
        </button>
        <button type="button" onClick={() => editor.chain().focus().redo().run()}>
          Redo
        </button>
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
      .then((r) => r.json())
      .then((data: { pages: LegalPage[] }) => {
        setPages(data.pages);
        setSelected(data.pages[0]?.slug ?? null);
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
