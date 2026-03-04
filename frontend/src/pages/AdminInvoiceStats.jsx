import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../utils/axios';
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

export default function AdminInvoiceStats() {
  const [data, setData] = useState({ list: [], summary: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloadingUserId, setDownloadingUserId] = useState(null);

  const handleDownloadInvoice = async (userId, userName) => {
    setDownloadingUserId(userId);
    try {
      const response = await api.get(`/admin/users/${userId}/invoice`, { responseType: 'blob' });
      const disposition = response.headers['content-disposition'];
      const fileNameMatch = disposition?.match(/filename="?([^"]+)"?/);
      const fullName = (userName || 'Invoice').replace(/\s+/g, '_');
      const fileName = fileNameMatch?.[1] || `MIRI_Invoice_${fullName}.pdf`;
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
        err.response.data.text().then((text) => {
          try {
            const jsonError = JSON.parse(text);
            alert(jsonError.message || 'Error downloading invoice.');
          } catch {
            alert('Error downloading invoice.');
          }
        });
      } else {
        alert(err.response?.data?.message || 'Error downloading invoice.');
      }
    } finally {
      setDownloadingUserId(null);
    }
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get('/admin/invoice-stats');
        setData({ list: res.data.list || [], summary: res.data.summary || null });
      } catch (err) {
        setError(err.response?.data?.message || 'Error loading invoice statistics');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-mesh-gradient flex items-center justify-center">
        <div className="ambient-orb-1" />
        <div className="ambient-orb-2" />
        <div className="ambient-orb-3" />
        <Navbar />
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="flex flex-col items-center justify-center py-24">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4" />
            <p className="text-gray-600">Loading invoice statistics...</p>
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

  return (
    <div className="min-h-screen bg-mesh-gradient relative">
      <div className="ambient-orb-1" />
      <div className="ambient-orb-2" />
      <div className="ambient-orb-3" />
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Invoice Statistics (MIRI)</h1>
            <p className="text-gray-600 mt-1">Overview of generated invoices, payment deadlines and estimated revenue</p>
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

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700">
            {error}
          </div>
        )}

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
          <div className="p-6 border-b border-gray-200/60">
            <h2 className="text-lg font-semibold text-gray-900">Invoices list</h2>
            <p className="text-sm text-gray-500">User, dates, payment deadline and total per MIRI invoice</p>
          </div>
          <div className="overflow-x-auto">
            {list.length === 0 ? (
              <div className="p-12 text-center text-gray-500">No invoices with dates yet.</div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-200">
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700">User</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700">Start</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700">End</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700">Weeks</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700">Discount %</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700">Payment deadline</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700">Total (USD)</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700">Paid</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700">Invoice</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((row, idx) => (
                    <tr key={row.userId?.toString() || idx} className="border-b border-gray-100 hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{row.userName || '—'}</div>
                        <div className="text-xs text-gray-500">{row.userEmail || '—'}</div>
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
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800" title="Pagado">
                            ✓ Paid
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
