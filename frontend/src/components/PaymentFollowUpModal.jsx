import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import api from '../utils/axios';

// Outcome of the follow-up with a student who has not paid. Values match the backend enum.
export const FOLLOW_UP_STATUSES = [
  { value: 'pending', label: 'Pending decision', badge: 'bg-amber-100 text-amber-800', active: 'bg-amber-500 text-white border-amber-500' },
  { value: 'reschedule', label: 'Reschedule dates', badge: 'bg-blue-100 text-blue-800', active: 'bg-blue-600 text-white border-blue-600' },
  { value: 'continuing', label: 'Will continue', badge: 'bg-green-100 text-green-800', active: 'bg-green-600 text-white border-green-600' },
  { value: 'dropped_out', label: 'Dropped out', badge: 'bg-red-100 text-red-800', active: 'bg-red-600 text-white border-red-600' },
];

const formatDateTime = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export default function PaymentFollowUpModal({ student, onClose, onUpdated }) {
  const [followUp, setFollowUp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [noteText, setNoteText] = useState('');

  const basePath = `/admin/users/${student.userId}/payment-follow-up`;

  useEffect(() => {
    let cancelled = false;
    api
      .get(basePath)
      .then((res) => {
        if (!cancelled) setFollowUp(res.data.followUp);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || 'Error loading follow-up notes.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [basePath]);

  const requestClose = useCallback(() => {
    if (noteText.trim() && !confirm('Discard the note you have not added yet?')) return;
    onClose();
  }, [noteText, onClose]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [requestClose]);

  // Every write returns the full follow-up plus the summary the table row shows
  const save = async (request, errorMessage) => {
    setSaving(true);
    setError(null);
    try {
      const res = await request();
      setFollowUp(res.data.followUp);
      onUpdated(student.userId, res.data.summary);
      return true;
    } catch (err) {
      setError(err.response?.data?.message || errorMessage);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleStatus = (value) => {
    // Clicking the selected outcome again clears it
    const status = followUp?.status === value ? null : value;
    save(() => api.patch(basePath, { status }), 'Error updating the follow-up status.');
  };

  const handleChecklist = (key, done) => {
    save(() => api.patch(basePath, { checklist: { [key]: done } }), 'Error updating the checklist.');
  };

  const handleAddNote = async (e) => {
    e?.preventDefault();
    const text = noteText.trim();
    if (!text) return;
    const ok = await save(() => api.post(`${basePath}/notes`, { text }), 'Error adding the note.');
    if (ok) setNoteText('');
  };

  const handleDeleteNote = (noteId) => {
    if (!confirm('Delete this note?')) return;
    save(() => api.delete(`${basePath}/notes/${noteId}`), 'Error deleting the note.');
  };

  // Portal to body: page wrappers like .bg-mesh-gradient force `position: relative`
  // on their direct children, which would pin the overlay below the table.
  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={requestClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-follow-up-title"
        className="glass-card bg-white/95 max-w-xl w-full max-h-[90vh] overflow-y-auto rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white/90 backdrop-blur-xl border-b border-gray-200/60 px-6 py-4 flex items-start justify-between gap-4 z-10">
          <div className="min-w-0">
            <h2 id="payment-follow-up-title" className="text-lg font-semibold text-gray-900">
              Payment follow-up
            </h2>
            <p className="text-sm text-gray-700 truncate">{student.userName || '—'}</p>
            <p className="text-xs text-gray-500 truncate">{student.userEmail || ''}</p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="p-1 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
            </div>
          ) : followUp && (
            <>
              <section>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Outcome</h3>
                <div className="grid grid-cols-2 gap-2">
                  {FOLLOW_UP_STATUSES.map((s) => {
                    const selected = followUp.status === s.value;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => handleStatus(s.value)}
                        disabled={saving}
                        aria-pressed={selected}
                        className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-60 ${
                          selected ? s.active : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
                {followUp.status && followUp.statusUpdatedAt && (
                  <p className="text-xs text-gray-500 mt-2">
                    Set by {followUp.statusUpdatedBy || 'admin'} · {formatDateTime(followUp.statusUpdatedAt)}
                  </p>
                )}
              </section>

              <section>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Checklist</h3>
                <ul className="space-y-2">
                  {followUp.checklist.map((item) => (
                    <li key={item.key}>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.done}
                          disabled={saving}
                          onChange={(e) => handleChecklist(item.key, e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-gray-300"
                        />
                        <span>
                          <span className={`block text-sm ${item.done ? 'text-gray-900' : 'text-gray-700'}`}>
                            {item.label}
                          </span>
                          {item.done && (
                            <span className="block text-xs text-gray-500">
                              {item.doneBy || 'admin'} · {formatDateTime(item.doneAt)}
                            </span>
                          )}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Notes</h3>
                <form onSubmit={handleAddNote} className="space-y-2">
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddNote(e);
                    }}
                    rows={3}
                    maxLength={2000}
                    placeholder="e.g. Sent a reminder email, student asked to move the start to next month"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={saving || !noteText.trim()}
                      className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? 'Saving…' : 'Add note'}
                    </button>
                  </div>
                </form>

                {followUp.notes.length === 0 ? (
                  <p className="text-sm text-gray-500 mt-3">No notes yet.</p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {followUp.notes.map((note) => (
                      <li key={note.id} className="rounded-lg border border-gray-200 bg-white/70 p-3">
                        <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{note.text}</p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-xs text-gray-500">
                            {note.authorName || 'admin'} · {formatDateTime(note.createdAt)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteNote(note.id)}
                            disabled={saving}
                            className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
