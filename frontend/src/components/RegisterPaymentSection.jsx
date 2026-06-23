import { useRef, useState } from 'react';
import api from '../utils/axios';

const formatDate = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

/**
 * Shown after the user has downloaded their Decision Letter (step4Completed).
 * Lets the user upload a payment receipt (PDF) so an admin can verify it.
 *
 * Works for both MIRI and EMFUTECH users. For MIRI users, the existing
 * ConfirmDatesSection still handles date confirmation + invoice download;
 * this component focuses on the payment proof upload portion of the journey.
 */
const RegisterPaymentSection = ({ applicationStatus, program, onSuccess }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const paymentProofStatus = applicationStatus?.paymentProofStatus || null;
  const paymentProofUploadedAt = applicationStatus?.paymentProofUploadedAt;
  const paymentProofApprovedAt = applicationStatus?.paymentProofApprovedAt;

  const isMIRI = program === 'MIRI';
  const isEMFUTECH = program === 'EMFUTECH';

  // MIRI users must wait for the invoice/date approval before uploading
  const miriBlockedByInvoice = isMIRI && applicationStatus?.invoiceStatus !== 'approved';

  const handleUpload = async (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setError('Please select a PDF file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('PDF must be 10MB or less.');
      return;
    }
    setError('');
    setUploading(true);
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
      setUploading(false);
    }
  };

  if (!isMIRI && !isEMFUTECH) return null;

  return (
    <div className="mt-8 pt-6 border-t border-white/40">
      <h3 className="text-lg font-bold text-gray-900 mb-2">Register Payment</h3>
      <p className="text-sm text-gray-600 mb-4">
        Upload your payment receipt in PDF format. An admin will review and approve it; once approved, your registration payment will be marked as verified
        {isMIRI ? ' and your invoice will be marked as paid.' : '.'}
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

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
        <div className="space-y-3">
          {paymentProofStatus === 'rejected' && (
            <p className="text-sm text-red-600">Your previous proof was not accepted. Please upload a new one below.</p>
          )}

          {miriBlockedByInvoice ? (
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
              <p className="text-sm text-blue-800">
                Your MIRI invoice must be approved before you can upload the tuition payment receipt. Please confirm your participation dates above and wait for admin approval.
              </p>
            </div>
          ) : (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={handleUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center justify-center bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-sm rounded-full px-6 py-2.5 shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Upload payment receipt (PDF)'}
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </button>
              <p className="text-xs text-gray-500">PDF only, max 10MB</p>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default RegisterPaymentSection;
