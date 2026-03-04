import { useState, useRef } from 'react';
import api from '../utils/axios';

const formatDate = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

/**
 * MIRI only. Shown after acceptance letter is downloaded (step4Completed).
 * Lets user submit date range, shows pending/approved/rejected and download invoice when approved.
 * After invoice is approved: section to upload payment proof PDF and see status.
 */
const ConfirmDatesSection = ({ applicationStatus, onSuccess }) => {
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const invoiceStatus = applicationStatus?.invoiceStatus || null;
  const dateRange = applicationStatus?.invoiceDateRange;
  const scholarshipPercentage = applicationStatus?.scholarshipPercentage ?? null;
  const paymentProofStatus = applicationStatus?.paymentProofStatus || null;
  const paymentProofUploadedAt = applicationStatus?.paymentProofUploadedAt;
  const paymentProofApprovedAt = applicationStatus?.paymentProofApprovedAt;

  const handleSubmitDates = async (e) => {
    e.preventDefault();
    setError('');
    if (!dateRangeStart || !dateRangeEnd) {
      setError('Please select both start and end dates.');
      return;
    }
    const start = new Date(dateRangeStart);
    const end = new Date(dateRangeEnd);
    if (end <= start) {
      setError('End date must be after start date.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/application/confirm-dates', {
        dateRangeStart: start.toISOString(),
        dateRangeEnd: end.toISOString(),
      });
      if (typeof onSuccess === 'function') onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Error submitting dates.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadInvoice = async () => {
    setError('');
    setDownloading(true);
    try {
      const response = await api.get('/application/invoice', { responseType: 'blob' });
      const disposition = response.headers['content-disposition'];
      const fileNameMatch = disposition?.match(/filename="?([^"]+)"?/);
      const fileName = fileNameMatch?.[1] || 'MIRI_Invoice.pdf';
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
            setError(jsonError.message || 'Error downloading invoice.');
          } catch {
            setError('Error downloading invoice.');
          }
        });
      } else {
        setError(err.response?.data?.message || 'Error downloading invoice.');
      }
    } finally {
      setDownloading(false);
    }
  };

  const handleUploadPaymentProof = async (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setError('Please select a PDF file.');
      return;
    }
    setError('');
    setUploadingProof(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.post('/application/upload-payment-proof', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (typeof onSuccess === 'function') onSuccess();
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError(err.response?.data?.message || 'Error uploading payment proof.');
    } finally {
      setUploadingProof(false);
    }
  };

  return (
    <div className="mt-8 pt-6 border-t border-white/40">
      <h3 className="text-lg font-bold text-gray-900 mb-3">Confirm dates</h3>
      <p className="text-sm text-gray-600 mb-4">
        Select your program participation date range. An admin will verify and approve; then you can download your invoice.
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      {invoiceStatus === 'approved' && (
        <>
          <div className="mb-4 p-4 rounded-xl bg-green-50 border border-green-200">
            <p className="text-sm font-medium text-green-800">
              Your dates have been approved.
              {scholarshipPercentage != null && scholarshipPercentage > 0 && (
                <span> Scholarship: {scholarshipPercentage}%</span>
              )}
            </p>
            <p className="text-sm text-green-700 mt-1">
              {dateRange?.startDate && dateRange?.endDate && (
                <>Period: {formatDate(dateRange.startDate)} – {formatDate(dateRange.endDate)}</>
              )}
            </p>
            <button
              type="button"
              onClick={handleDownloadInvoice}
              disabled={downloading}
              className="mt-3 inline-flex items-center justify-center bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm rounded-full px-6 py-2.5 shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50"
            >
              {downloading ? 'Downloading...' : 'Download Invoice PDF'}
              <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
          </div>

          {/* Payment proof - after invoice approved */}
          <div className="mt-6 pt-6 border-t border-white/40">
            <h4 className="text-base font-bold text-gray-900 mb-2">Payment proof</h4>
            <p className="text-sm text-gray-600 mb-4">
              After paying, upload your payment proof in PDF. An admin will verify and approve; once approved, your payment will be marked as paid.
            </p>
            {paymentProofStatus === 'approved' && (
              <div className="p-4 rounded-xl bg-green-50 border border-green-200">
                <p className="text-sm font-medium text-green-800">Payment verified</p>
                {paymentProofApprovedAt && (
                  <p className="text-sm text-green-700 mt-1">Approved on {formatDate(paymentProofApprovedAt)}</p>
                )}
              </div>
            )}
            {paymentProofStatus === 'pending' && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                <p className="text-sm font-medium text-amber-800">Payment proof under review</p>
                {paymentProofUploadedAt && (
                  <p className="text-sm text-amber-700 mt-1">Uploaded on {formatDate(paymentProofUploadedAt)}</p>
                )}
              </div>
            )}
            {(paymentProofStatus === 'rejected' || paymentProofStatus === null || !paymentProofStatus) && (
              <div className="space-y-2">
                {paymentProofStatus === 'rejected' && (
                  <p className="text-sm text-red-600">Your previous proof was not accepted. You can upload a new one below.</p>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={handleUploadPaymentProof}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingProof}
                  className="inline-flex items-center justify-center bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-sm rounded-full px-6 py-2.5 shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                >
                  {uploadingProof ? 'Uploading...' : 'Upload payment proof (PDF)'}
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </button>
                <p className="text-xs text-gray-500">PDF only, max 10MB</p>
              </div>
            )}
          </div>
        </>
      )}

      {invoiceStatus === 'pending' && (
        <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <p className="text-sm font-medium text-amber-800">Waiting for admin approval</p>
          {dateRange?.startDate && dateRange?.endDate && (
            <p className="text-sm text-amber-700 mt-1">
              Your submitted period: {formatDate(dateRange.startDate)} – {formatDate(dateRange.endDate)}
            </p>
          )}
          <p className="text-sm text-amber-600 mt-1">You will be able to download the invoice after approval.</p>
        </div>
      )}

      {invoiceStatus === 'rejected' && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200">
          <p className="text-sm font-medium text-red-800">Your date request was not approved.</p>
          <p className="text-sm text-red-600 mt-1">You can submit a new date range below.</p>
        </div>
      )}

      {(invoiceStatus === null || invoiceStatus === 'rejected' || !invoiceStatus) && (
        <form onSubmit={handleSubmitDates} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
              <input
                type="date"
                value={dateRangeStart}
                onChange={(e) => setDateRangeStart(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min={new Date().toISOString().slice(0, 10)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
              <input
                type="date"
                value={dateRangeEnd}
                onChange={(e) => setDateRangeEnd(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min={dateRangeStart || new Date().toISOString().slice(0, 10)}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-sm rounded-full px-6 py-2.5 shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit dates'}
          </button>
        </form>
      )}
    </div>
  );
};

export default ConfirmDatesSection;
