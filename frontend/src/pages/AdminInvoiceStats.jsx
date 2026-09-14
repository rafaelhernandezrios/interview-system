import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../utils/axios';
import PaymentFollowUpModal, { FOLLOW_UP_STATUSES } from '../components/PaymentFollowUpModal';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

const formatDate = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatMonth = (yyyyMm) => {
  if (!yyyyMm) return '';
  const [y, m] = yyyyMm.split('-');
  const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

// Programs without the MIRI invoice flow: students upload a payment proof right
// after their decision letter, so there is no date range and no invoice amount.
const PROGRAM_PAYMENT_VIEW = 'EMFUTECH';

export default function AdminInvoiceStats() {
  const [view, setView] = useState('MIRI'); // 'MIRI' (invoices) | 'EMFUTECH' (payments)
  const [data, setData] = useState({ list: [], summary: null });
  const [programData, setProgramData] = useState({ list: [], summary: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloadingUserId, setDownloadingUserId] = useState(null);
  const [downloadingProofUserId, setDownloadingProofUserId] = useState(null);
  const [markingUnpaidUserId, setMarkingUnpaidUserId] = useState(null);
  const [markingPaidUserId, setMarkingPaidUserId] = useState(null);
  const [onlyWithLetter, setOnlyWithLetter] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [followUpStudent, setFollowUpStudent] = useState(null);

  const fetchStats = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const res = await api.get('/admin/invoice-stats');
      setData({ list: res.data.list || [], summary: res.data.summary || null });
    } catch (err) {
      setError(err.response?.data?.message || 'Error loading invoice statistics');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const fetchProgramPayments = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const res = await api.get('/admin/program-payments', { params: { program: PROGRAM_PAYMENT_VIEW } });
      setProgramData({ list: res.data.list || [], summary: res.data.summary || null });
    } catch (err) {
      setError(err.response?.data?.message || `Error loading ${PROGRAM_PAYMENT_VIEW} payments`);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const refreshCurrentView = useCallback(
    () => (view === 'MIRI' ? fetchStats({ silent: true }) : fetchProgramPayments({ silent: true })),
    [view, fetchStats, fetchProgramPayments]
  );

  const closeFollowUp = useCallback(() => setFollowUpStudent(null), []);

  // Patch the row in place: refetching would reset the page to its loading state
  const handleFollowUpUpdated = useCallback((userId, followUpSummary) => {
    const applySummary = (prev) => ({
      ...prev,
      list: prev.list.map((row) => (row.userId === userId ? { ...row, ...followUpSummary } : row)),
    });
    setData(applySummary);
    setProgramData(applySummary);
  }, []);

  // Download a blob response as a file, surfacing JSON error bodies returned as blobs
  const downloadBlob = async (request, fallbackFileName, errorMessage) => {
    try {
      const response = await request();
      const disposition = response.headers['content-disposition'];
      const fileNameMatch = disposition?.match(/filename="?([^"]+)"?/);
      const fileName = fileNameMatch?.[1] || fallbackFileName;
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      if (err.response?.data instanceof Blob) {
        const text = await err.response.data.text();
        try {
          alert(JSON.parse(text).message || errorMessage);
        } catch {
          alert(errorMessage);
        }
      } else {
        alert(err.response?.data?.message || errorMessage);
      }
    }
  };

  const handleDownloadPaymentProof = async (userId, userName) => {
    setDownloadingProofUserId(userId);
    await downloadBlob(
      () => api.get(`/admin/users/${userId}/payment-proof`, { responseType: 'blob' }),
      `Payment_Proof_${(userName || 'User').replace(/\s+/g, '_')}.pdf`,
      'Error downloading payment proof.'
    );
    setDownloadingProofUserId(null);
  };

  const handleMarkUnpaid = async (userId) => {
    if (!confirm('Mark this payment as unpaid? The payment proof will go back to pending review.')) return;
    setMarkingUnpaidUserId(userId);
    try {
      await api.patch(`/admin/users/${userId}/payment-proof-unpaid`);
      await refreshCurrentView();
    } catch (err) {
      alert(err.response?.data?.message || 'Error marking as unpaid.');
    } finally {
      setMarkingUnpaidUserId(null);
    }
  };

  const handleMarkPaid = async (userId, hasProof) => {
    if (!confirm(hasProof
      ? 'Mark this payment as paid (approve this proof)?'
      : 'Mark this payment as paid? No proof was uploaded for this student.')) return;
    setMarkingPaidUserId(userId);
    try {
      await api.patch(`/admin/users/${userId}/payment-proof-paid`);
      await refreshCurrentView();
    } catch (err) {
      alert(err.response?.data?.message || 'Error marking as paid.');
    } finally {
      setMarkingPaidUserId(null);
    }
  };

  const handleDownloadExcel = async () => {
    setExportingExcel(true);
    if (view === 'MIRI') {
      await downloadBlob(
        () => api.get('/admin/invoice-stats/export', { responseType: 'blob' }),
        `MIRI_Invoices_${new Date().toISOString().slice(0, 10)}.xlsx`,
        'Error downloading Excel.'
      );
    } else {
      await downloadBlob(
        () => api.get('/admin/program-payments/export', {
          params: { program: PROGRAM_PAYMENT_VIEW },
          responseType: 'blob',
        }),
        `${PROGRAM_PAYMENT_VIEW}_Payments_${new Date().toISOString().slice(0, 10)}.xlsx`,
        'Error downloading Excel.'
      );
    }
    setExportingExcel(false);
  };

  const handleDownloadInvoice = async (userId, userName) => {
    setDownloadingUserId(userId);
    await downloadBlob(
      () => api.get(`/admin/users/${userId}/invoice`, { responseType: 'blob' }),
      `MIRI_Invoice_${(userName || 'Invoice').replace(/\s+/g, '_')}.pdf`,
      'Error downloading invoice.'
    );
    setDownloadingUserId(null);
  };

  useEffect(() => {
    if (view === 'MIRI') fetchStats();
    else fetchProgramPayments();
  }, [view, fetchStats, fetchProgramPayments]);

  // Loading uses the same page wrapper as the loaded state: centering the whole
  // page would turn the navbar into a centered flex item and make it jump once
  // the data arrives. Only the spinner block is centered.
  if (loading) {
    return (
      <div className="min-h-screen bg-mesh-gradient relative">
        <div className="ambient-orb-1" />
        <div className="ambient-orb-2" />
        <div className="ambient-orb-3" />
        <Navbar />
        <div className="container mx-auto px-4 py-8 max-w-7xl xl:max-w-[1500px] 2xl:max-w-[1800px]">
          <div className="flex flex-col items-center justify-center py-24">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4" />
            <p className="text-gray-600">
              {view === 'MIRI' ? 'Loading invoice statistics...' : `Loading ${PROGRAM_PAYMENT_VIEW} payments...`}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const summary = data.summary || {};
  const list = data.list || [];
  const paidList = list.filter((row) => row.isPaid);
  const paidCount = paidList.length;
  const paidRevenue = paidList.reduce((sum, row) => sum + (row.total ?? 0), 0);
  const unpaidCount = list.length - paidCount;
  const paidChartData = [
    { name: 'Paid', count: paidCount },
    { name: 'Unpaid', count: unpaidCount },
  ].filter((d) => d.count > 0);

  const revenueByMonth = (summary.revenueByMonth || []).map(({ month, value }) => ({
    month: formatMonth(month),
    monthKey: month,
    revenue: value,
  }));
  const studentsByMonth = (summary.studentsByMonth || []).map(({ month, count }) => ({
    month: formatMonth(month),
    monthKey: month,
    students: count,
  }));

  const allProgramRows = programData.list || [];
  const programList = onlyWithLetter
    ? allProgramRows.filter((row) => row.acceptanceLetterGeneratedAt)
    : allProgramRows;
  const programSummary = programData.summary || {};

  // Payment proof status badge, shared by both views
  const renderPaymentBadge = (row) => {
    if (row.isPaid) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
          ✓ Paid
        </span>
      );
    }
    if (row.paymentProofStatus === 'pending') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
          ⏳ In review
        </span>
      );
    }
    if (row.paymentProofStatus === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
          ✗ Rejected
        </span>
      );
    }
    return <span className="text-gray-400 text-sm">Not uploaded</span>;
  };

  // Notes button with the follow-up outcome and checklist progress, shared by both views
  const renderFollowUpButton = (row) => {
    const status = FOLLOW_UP_STATUSES.find((s) => s.value === row.followUpStatus);
    return (
      <div className="flex flex-col items-start gap-1">
        <button
          type="button"
          onClick={() => setFollowUpStudent(row)}
          title={row.followUpLatestNote || 'Add follow-up notes'}
          className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-medium text-sm whitespace-nowrap"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          {row.followUpNotesCount > 0 ? `Notes (${row.followUpNotesCount})` : 'Notes'}
        </button>
        {status && (
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${status.badge}`}>
            {status.label}
          </span>
        )}
        {row.followUpChecklistDone > 0 && (
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {row.followUpChecklistDone}/{row.followUpChecklistTotal} steps done
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-mesh-gradient relative">
      <div className="ambient-orb-1" />
      <div className="ambient-orb-2" />
      <div className="ambient-orb-3" />
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-7xl xl:max-w-[1500px] 2xl:max-w-[1800px]">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              {view === 'MIRI' ? 'Invoice Statistics (MIRI)' : `Payments (${PROGRAM_PAYMENT_VIEW})`}
            </h1>
            <p className="text-gray-600 mt-1">
              {view === 'MIRI'
                ? 'Overview of generated invoices, payment deadlines and estimated revenue'
                : `${PROGRAM_PAYMENT_VIEW} students pay without an invoice: this tracks their payment proofs`}
            </p>
          </div>
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Admin Panel
          </Link>
        </div>

        {/* Program views: MIRI bills with invoices, other programs only track payment proofs */}
        <div className="mb-6 flex flex-wrap gap-2">
          {['MIRI', PROGRAM_PAYMENT_VIEW].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setView(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                view === tab
                  ? 'bg-blue-600 text-white shadow'
                  : 'glass-card bg-white/40 text-gray-700 hover:bg-white/70'
              }`}
            >
              {tab === 'MIRI' ? 'MIRI · Invoices' : `${tab} · Payments`}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700">
            {error}
          </div>
        )}

        {view === PROGRAM_PAYMENT_VIEW ? (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="glass-card p-6">
                <p className="text-sm text-gray-600 mb-1">Students in program</p>
                <p className="text-2xl font-bold text-gray-900">{programSummary.totalStudents ?? 0}</p>
                <p className="text-sm text-gray-500 mt-1">{programSummary.letterSent ?? 0} with decision letter</p>
              </div>
              <div className="glass-card p-6 bg-green-50/80 border border-green-200/60">
                <p className="text-sm text-gray-700 mb-1">Paid</p>
                <p className="text-2xl font-bold text-green-700">{programSummary.paid ?? 0}</p>
              </div>
              <div className="glass-card p-6">
                <p className="text-sm text-gray-600 mb-1">Pending review</p>
                <p className="text-2xl font-bold text-amber-600">{programSummary.pendingReview ?? 0}</p>
                {(programSummary.rejected ?? 0) > 0 && (
                  <p className="text-sm text-red-600 mt-1">{programSummary.rejected} rejected</p>
                )}
              </div>
              <div className="glass-card p-6">
                <p className="text-sm text-gray-600 mb-1">No proof uploaded</p>
                <p className="text-2xl font-bold text-gray-900">{programSummary.notUploaded ?? 0}</p>
              </div>
            </div>

            {/* Table */}
            <div className="glass-card overflow-hidden">
              <div className="p-6 border-b border-gray-200/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{PROGRAM_PAYMENT_VIEW} students</h2>
                  <p className="text-sm text-gray-500">Decision letter, payment status and uploaded proof per student</p>
                  <label className="mt-2 inline-flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={onlyWithLetter}
                      onChange={(e) => setOnlyWithLetter(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    Only students with decision letter
                  </label>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadExcel}
                  disabled={exportingExcel || programList.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {exportingExcel ? 'Downloading…' : 'Download Excel'}
                </button>
              </div>
              <div className="overflow-x-auto">
                {programList.length === 0 ? (
                  <div className="p-12 text-center text-gray-500">No {PROGRAM_PAYMENT_VIEW} students yet.</div>
                ) : (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50/80 border-b border-gray-200">
                        <th className="px-4 py-3 text-sm font-semibold text-gray-700">Student</th>
                        <th className="px-2 sm:px-3 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">Student Code</th>
                        <th className="px-4 py-3 text-sm font-semibold text-gray-700">Decision letter</th>
                        <th className="px-4 py-3 text-sm font-semibold text-gray-700">Payment</th>
                        <th className="px-4 py-3 text-sm font-semibold text-gray-700">Proof uploaded</th>
                        <th className="px-4 py-3 text-sm font-semibold text-gray-700">Payment proof</th>
                        <th className="px-4 py-3 text-sm font-semibold text-gray-700">Actions</th>
                        <th className="px-4 py-3 text-sm font-semibold text-gray-700">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {programList.map((row, idx) => (
                        <tr key={row.userId?.toString() || idx} className="border-b border-gray-100 hover:bg-gray-50/50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{row.userName || '—'}</div>
                            <div className="text-xs text-gray-500">{row.userEmail || '—'}</div>
                          </td>
                          <td className="px-2 sm:px-3 py-3 whitespace-nowrap min-w-[13rem]">
                            <p className="text-gray-700 text-xs font-medium">{row.studentCode || '—'}</p>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {row.acceptanceLetterGeneratedAt ? formatDate(row.acceptanceLetterGeneratedAt) : (
                              <span className="text-gray-400">Not sent</span>
                            )}
                          </td>
                          <td className="px-4 py-3">{renderPaymentBadge(row)}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {row.paymentProofUploadedAt ? formatDate(row.paymentProofUploadedAt) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            {row.hasPaymentProof ? (
                              <button
                                type="button"
                                onClick={() => handleDownloadPaymentProof(row.userId, row.userName)}
                                disabled={downloadingProofUserId === row.userId}
                                className="inline-flex items-center gap-1.5 text-purple-600 hover:text-purple-700 font-medium text-sm disabled:opacity-50"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                {downloadingProofUserId === row.userId ? '…' : 'Proof'}
                              </button>
                            ) : (
                              <span className="text-gray-400 text-sm">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {row.isPaid ? (
                              <button
                                type="button"
                                onClick={() => handleMarkUnpaid(row.userId)}
                                disabled={markingUnpaidUserId === row.userId}
                                className="text-xs font-medium text-amber-700 hover:text-amber-800 underline disabled:opacity-50"
                              >
                                {markingUnpaidUserId === row.userId ? '…' : 'Mark unpaid'}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleMarkPaid(row.userId, row.hasPaymentProof)}
                                disabled={markingPaidUserId === row.userId}
                                className="text-xs font-medium text-green-700 hover:text-green-800 underline disabled:opacity-50"
                              >
                                {markingPaidUserId === row.userId ? '…' : 'Mark paid'}
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3">{renderFollowUpButton(row)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="glass-card p-6">
              <p className="text-sm text-gray-600 mb-1">Approved revenue (estimated)</p>
              <p className="text-2xl font-bold text-green-600">
                ${(summary.totalApprovedRevenue ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="glass-card p-6">
              <p className="text-sm text-gray-600 mb-1">Pending revenue (estimated)</p>
              <p className="text-2xl font-bold text-amber-600">
                ${(summary.totalPendingRevenue ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="glass-card p-6">
              <p className="text-sm text-gray-600 mb-1">Total invoices</p>
              <p className="text-2xl font-bold text-gray-900">{summary.totalInvoices ?? 0}</p>
            </div>
            <div className="glass-card p-6 bg-green-50/80 border border-green-200/60">
              <p className="text-sm text-gray-700 mb-1">Invoices paid</p>
              <p className="text-2xl font-bold text-green-700">{paidCount}</p>
              {paidCount > 0 && (
                <p className="text-sm text-green-600 mt-1">
                  ${paidRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })} collected
                </p>
              )}
            </div>
          </div>
        )}

        {/* Charts - 3 equal columns when payment data exists, else 2 columns */}
        <div className={`grid gap-6 mb-8 ${paidChartData.length > 0 ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1 lg:grid-cols-2'}`}>
          {paidChartData.length > 0 && (
            <div className="glass-card p-6 rounded-2xl border border-gray-200/60">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Payment status</h2>
              <p className="text-sm text-gray-500 mb-4">Paid vs unpaid invoices</p>
              <div className="w-full h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={paidChartData} margin={{ top: 16, right: 16, left: 16, bottom: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip formatter={(v) => [v, 'Invoices']} />
                    <Bar dataKey="count" name="Invoices" radius={[4, 4, 0, 0]}>
                      {paidChartData.map((entry, index) => (
                        <Cell key={index} fill={entry.name === 'Paid' ? '#10b981' : '#f59e0b'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Paid: {paidCount} · Unpaid: {unpaidCount}
              </p>
            </div>
          )}

          <div className="glass-card p-6 rounded-2xl border border-gray-200/60">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Revenue by deadline month</h2>
            <p className="text-sm text-gray-500 mb-4">Estimated revenue by payment deadline</p>
            {revenueByMonth.length > 0 ? (
              <div className="w-full h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueByMonth} margin={{ top: 16, right: 16, left: 16, bottom: 56 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" height={48} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                    <Tooltip formatter={(v) => [`$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 'Revenue']} />
                    <Bar dataKey="revenue" fill="#2563eb" name="Revenue (USD)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-gray-500">No data yet</div>
            )}
          </div>

          <div className="glass-card p-6 rounded-2xl border border-gray-200/60">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Students by start month</h2>
            <p className="text-sm text-gray-500 mb-4">Program start distribution</p>
            {studentsByMonth.length > 0 ? (
              <div className="w-full h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={studentsByMonth} margin={{ top: 16, right: 16, left: 16, bottom: 56 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" height={48} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="students" fill="#7c3aed" name="Students" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-gray-500">No data yet</div>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="glass-card overflow-hidden">
          <div className="p-6 border-b border-gray-200/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Invoices list</h2>
              <p className="text-sm text-gray-500">User, dates, payment deadline and total per MIRI invoice</p>
            </div>
            <button
              type="button"
              onClick={handleDownloadExcel}
              disabled={exportingExcel || list.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {exportingExcel ? 'Downloading…' : 'Download Excel'}
            </button>
          </div>
          <div className="overflow-x-auto">
            {list.length === 0 ? (
              <div className="p-12 text-center text-gray-500">No invoices with dates yet.</div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-200">
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700">User</th>
                    <th className="px-2 sm:px-3 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">Student Code</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700">Start</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700">End</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700">Weeks</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700">Discount %</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700">Payment deadline</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700">Total (USD)</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700">Paid</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700">Invoice</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700">Payment proof</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((row, idx) => (
                    <tr key={row.userId?.toString() || idx} className="border-b border-gray-100 hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{row.userName || '—'}</div>
                        <div className="text-xs text-gray-500">{row.userEmail || '—'}</div>
                      </td>
                      <td className="px-2 sm:px-3 py-3 whitespace-nowrap min-w-[13rem]">
                        <p className="text-gray-700 text-xs font-medium">
                          {row.studentCode || '—'}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatDate(row.startDate)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatDate(row.endDate)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-700">{row.weeks != null ? row.weeks : '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {row.scholarshipPercentage != null && row.scholarshipPercentage > 0 ? `${row.scholarshipPercentage}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatDate(row.paymentDeadline)}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        ${(row.total ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3">
                        {row.isPaid ? (
                          <div className="flex flex-col items-start gap-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800" title="Pagado">
                              ✓ Paid
                            </span>
                            <button
                              type="button"
                              onClick={() => handleMarkUnpaid(row.userId)}
                              disabled={markingUnpaidUserId === row.userId}
                              className="text-xs font-medium text-amber-700 hover:text-amber-800 underline disabled:opacity-50"
                              title="Revert to unpaid (the payment proof goes back to pending review)"
                            >
                              {markingUnpaidUserId === row.userId ? '…' : 'Mark unpaid'}
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">
                            {row.paymentProofStatus === 'pending' ? 'Pending review' : '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleDownloadInvoice(row.userId, row.userName)}
                          disabled={downloadingUserId === row.userId}
                          className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-medium text-sm disabled:opacity-50"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          {downloadingUserId === row.userId ? '…' : 'PDF'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        {row.hasPaymentProof ? (
                          <button
                            type="button"
                            onClick={() => handleDownloadPaymentProof(row.userId, row.userName)}
                            disabled={downloadingProofUserId === row.userId}
                            className="inline-flex items-center gap-1.5 text-purple-600 hover:text-purple-700 font-medium text-sm disabled:opacity-50"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            {downloadingProofUserId === row.userId ? '…' : 'Proof'}
                          </button>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{renderFollowUpButton(row)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
          </>
        )}
      </div>

      {followUpStudent && (
        <PaymentFollowUpModal
          student={followUpStudent}
          onClose={closeFollowUp}
          onUpdated={handleFollowUpUpdated}
        />
      )}
    </div>
  );
}
