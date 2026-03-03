import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../utils/axios';
import {
  BarChart,
  Bar,
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
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
          </div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue by payment deadline month</h2>
            {revenueByMonth.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={revenueByMonth} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip formatter={(v) => [`$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 'Revenue']} />
                  <Bar dataKey="revenue" fill="#2563eb" name="Revenue (USD)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 py-8 text-center">No data yet</p>
            )}
          </div>
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Students by program start month</h2>
            {studentsByMonth.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={studentsByMonth} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="students" fill="#7c3aed" name="Students" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 py-8 text-center">No data yet</p>
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
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700">Payment deadline</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700">Total (USD)</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700">Status</th>
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
                      <td className="px-4 py-3 text-sm text-gray-700">{formatDate(row.paymentDeadline)}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        ${(row.total ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            row.invoiceStatus === 'approved'
                              ? 'bg-green-100 text-green-700'
                              : row.invoiceStatus === 'pending'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {row.invoiceStatus === 'approved' ? 'Approved' : row.invoiceStatus === 'pending' ? 'Pending' : 'Rejected'}
                        </span>
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
