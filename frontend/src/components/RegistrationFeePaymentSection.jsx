import { useState } from 'react';
import api from '../utils/axios';

const formatDate = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

/**
 * MIRI only. Shown after the decision letter is downloaded (step4Completed).
 * Step 5: pay the USD 250 registration fee via Stripe Checkout.
 */
const RegistrationFeePaymentSection = ({ applicationStatus, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const registrationFeePaid = applicationStatus?.registrationFeePaid === true;
  const registrationFeePaidAt = applicationStatus?.registrationFeePaidAt;
  const amountUsd = applicationStatus?.registrationFeeAmountUsd ?? 250;
  const stripeConfigured = applicationStatus?.stripeConfigured !== false;

  const handlePay = async () => {
    setError('');
    setLoading(true);
    try {
      const response = await api.post('/application/registration-fee/checkout');
      const checkoutUrl = response.data?.url;
      if (!checkoutUrl) {
        throw new Error('Checkout URL not received');
      }
      window.location.href = checkoutUrl;
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error starting payment.');
      setLoading(false);
    }
  };

  if (registrationFeePaid) {
    return (
      <div className="mt-8 pt-6 border-t border-white/40">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Registration Fee Payment</h3>
        <div className="p-4 rounded-xl bg-green-50 border border-green-200">
          <p className="text-sm font-medium text-green-800">Registration fee paid</p>
          {registrationFeePaidAt && (
            <p className="text-sm text-green-700 mt-1">Paid on {formatDate(registrationFeePaidAt)}</p>
          )}
          <p className="text-sm text-green-700 mt-2">
            You can now select your program participation dates below. An admin will review and approve them before your invoice is generated.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 pt-6 border-t border-white/40">
      <h3 className="text-lg font-bold text-gray-900 mb-2">Registration Fee Payment</h3>
      <p className="text-sm text-gray-600 mb-4">
        Pay the one-time program registration fee of <strong>USD {amountUsd}</strong> to continue.
        After payment, you will be able to select your participation dates and receive your invoice.
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      {!stripeConfigured ? (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
          <p className="text-sm text-amber-800">
            Online payment is temporarily unavailable. Please contact support to complete your registration fee payment.
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={handlePay}
          disabled={loading}
          className="inline-flex items-center justify-center bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-sm rounded-full px-6 py-2.5 shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50"
        >
          {loading ? 'Redirecting to Stripe...' : `Pay USD ${amountUsd} with Stripe`}
          <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default RegistrationFeePaymentSection;
