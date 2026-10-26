import { useEffect, useMemo, useState } from 'react';
import Navbar from '../components/Navbar';
import api from '../utils/axios';

const PAGE_SIZE = 50;

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

const PROGRAM_LABELS = {
  MIRI: 'MIRI',
  EMFUTECH: 'EMFUTECH',
  JCTI: 'JCTI',
  MIRAITEACH: 'MiraiTeach',
  FUTURE_INNOVATORS_JAPAN: 'Future Innovators Japan',
  OTHER: 'Other',
};

const STATUS_FILTERS = [
  { value: '', label: 'All students' },
  { value: 'not-reported', label: 'Not reported yet' },
  { value: 'interviewed', label: 'Interviewed' },
  { value: 'not-interviewed', label: 'Not interviewed' },
];

const reviewStatus = (student) => {
  if (!student.managerReview) return 'not-reported';
  return student.managerReview.interviewed ? 'interviewed' : 'not-interviewed';
};

const StudentRow = ({ student, onSaved }) => {
  const review = student.managerReview;
  const [interviewed, setInterviewed] = useState(review ? review.interviewed : null);
  const [comments, setComments] = useState(review?.comments || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const isDirty = interviewed !== (review ? review.interviewed : null) || comments !== (review?.comments || '');

  const handleSave = async () => {
    setError('');
    setNotice('');
    if (interviewed === null) {
      setError('Select Yes or No first.');
      return;
    }
    setSaving(true);
    try {
      const response = await api.put(`/manager/students/${student._id}/review`, { interviewed, comments });
      onSaved(student._id, response.data.managerReview);
      setNotice(response.data.adminsNotified ? 'Saved. The admins have been notified.' : 'Saved.');
    } catch (err) {
      setError(err.response?.data?.message || 'Error saving the report.');
    } finally {
      setSaving(false);
    }
  };

  const choiceClass = (active, tone) =>
    `px-4 py-2 text-sm font-semibold rounded-lg border transition ${
      active
        ? tone === 'yes'
          ? 'bg-green-600 border-green-600 text-white'
          : 'bg-gray-700 border-gray-700 text-white'
        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
    }`;

  return (
    <div className="glass-card p-4 sm:p-5">
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="lg:w-1/3 min-w-0">
          <p className="text-lg font-bold text-gray-900 break-words">{student.name}</p>
          <p className="text-sm text-gray-600 break-all">{student.email}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">
              {PROGRAM_LABELS[student.program] || 'No program'}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              Registered {formatDate(student.registeredAt)}
            </span>
            {student.decisionLetterSentAt && (
              <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">
                Decision letter sent
              </span>
            )}
          </div>
          {review && (
            <p className="mt-2 text-xs text-gray-500">
              Last report by {review.reportedByName || 'a manager'} on {formatDate(review.updatedAt || review.reportedAt)}
            </p>
          )}
        </div>

        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-700 mr-1">Did you interview this student?</span>
            <button type="button" onClick={() => setInterviewed(true)} className={choiceClass(interviewed === true, 'yes')}>
              Yes
            </button>
            <button type="button" onClick={() => setInterviewed(false)} className={choiceClass(interviewed === false, 'no')}>
              No
            </button>
          </div>
          <textarea
            rows={3}
            maxLength={3000}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Comments about the student"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !isDirty}
              className="inline-flex items-center justify-center bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-sm rounded-full px-6 py-2.5 shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
            >
              {saving ? 'Saving...' : review ? 'Update report' : 'Save report'}
            </button>
            {error && <span className="text-sm text-red-600">{error}</span>}
            {notice && !isDirty && <span className="text-sm text-green-700">{notice}</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

const ManagerPanel = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await api.get('/manager/students');
        setStudents(response.data.students || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Error loading students.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, programFilter, statusFilter]);

  const handleSaved = (studentId, managerReview) => {
    setStudents((prev) => prev.map((s) => (s._id === studentId ? { ...s, managerReview } : s)));
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      if (q && !`${s.name} ${s.email}`.toLowerCase().includes(q)) return false;
      if (programFilter && s.program !== programFilter) return false;
      if (statusFilter && reviewStatus(s) !== statusFilter) return false;
      return true;
    });
  }, [students, search, programFilter, statusFilter]);

  const counts = useMemo(
    () => ({
      interviewed: students.filter((s) => reviewStatus(s) === 'interviewed').length,
      pending: students.filter((s) => reviewStatus(s) === 'not-reported').length,
    }),
    [students]
  );

  const programs = useMemo(
    () => [...new Set(students.map((s) => s.program).filter(Boolean))].sort(),
    [students]
  );

  const selectClass =
    'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

  return (
    <div className="min-h-screen bg-mesh-gradient">
      <Navbar />
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Students</h1>
          <p className="text-sm text-gray-600 mt-1">
            Mark whether you interviewed each student and add your comments. When you mark a student as interviewed, the
            admins are notified so they can send the decision letter.
          </p>
          {!loading && !error && (
            <p className="text-sm text-gray-700 mt-2">
              {students.length} students · {counts.interviewed} interviewed · {counts.pending} not reported yet
            </p>
          )}
        </div>

        <div className="glass-card p-4 mb-6 flex flex-col md:flex-row gap-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email"
            className={`${selectClass} flex-1`}
          />
          <select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} className={selectClass}>
            <option value="">All programs</option>
            {programs.map((p) => (
              <option key={p} value={p}>{PROGRAM_LABELS[p] || p}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass}>
            {STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-600">Loading students...</div>
        ) : error ? (
          <div className="p-4 rounded-lg bg-red-50 text-red-700">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="glass-card p-8 text-center text-gray-600">No students match these filters.</div>
        ) : (
          <div className="space-y-4">
            {filtered.slice(0, visibleCount).map((student) => (
              <StudentRow key={student._id} student={student} onSaved={handleSaved} />
            ))}
            {filtered.length > visibleCount && (
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                  className="inline-flex items-center justify-center bg-white border border-gray-300 text-gray-800 font-semibold text-sm rounded-full px-6 py-2.5 hover:bg-gray-50"
                >
                  Show more ({filtered.length - visibleCount} left)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ManagerPanel;
