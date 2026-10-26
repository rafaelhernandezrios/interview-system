import { useState } from 'react';
import api from '../utils/axios';

export const ACCOMMODATION_SERVICE_URL = 'https://aura-neuro.tech/product/accommodation-service-fee/';

const ACCOMMODATION_LABELS = {
  mirai: "I'll use Mirai's accommodation service",
  own: "I'll arrange my own accommodation",
  undecided: 'Not decided yet',
};

// Flight times are entered and shown in Japan time (UTC+9, no daylight saving),
// so they read the same whatever the student's own timezone is.
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const toJstInput = (d) => (d ? new Date(new Date(d).getTime() + JST_OFFSET_MS).toISOString().slice(0, 16) : '');
const fromJstInput = (v) => (v ? `${v}:00+09:00` : null);
const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const fromDateInput = (v) => (v ? `${v}T00:00:00Z` : null);

const formatJst = (d) =>
  d
    ? new Date(d).toLocaleString('en-US', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }) + ' (Japan time)'
    : '—';
const formatDay = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' }) : '—';

const buildForm = (t) => ({
  passportFullName: t?.passportFullName || '',
  passportNationality: t?.passportNationality || '',
  passportNumber: t?.passportNumber || '',
  passportExpiryDate: toDateInput(t?.passportExpiryDate),
  arrivalDateTime: toJstInput(t?.arrivalDateTime),
  arrivalAirport: t?.arrivalAirport || '',
  arrivalFlight: t?.arrivalFlight || '',
  departureDateTime: toJstInput(t?.departureDateTime),
  departureAirport: t?.departureAirport || '',
  departureFlight: t?.departureFlight || '',
  accommodationPlan: t?.accommodationPlan || '',
  notes: t?.notes || '',
});

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

const Field = ({ label, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    {children}
  </div>
);

const SummaryRow = ({ label, value }) => (
  <div>
    <p className="text-xs text-gray-500 uppercase">{label}</p>
    <p className="text-sm text-gray-800 font-medium break-words">{value || '—'}</p>
  </div>
);

export const AccommodationOffer = () => (
  <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 flex flex-col sm:flex-row sm:items-center gap-4">
    <div className="flex-1">
      <p className="text-base font-bold text-gray-900">Need a place to stay?</p>
      <p className="text-sm text-gray-600 mt-1">
        Mirai offers an accommodation service for program participants. Book it on the Mirai website, then choose
        &quot;Mirai&apos;s accommodation service&quot; below so we can plan your stay.
      </p>
    </div>
    <a
      href={ACCOMMODATION_SERVICE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="flex-shrink-0 inline-flex items-center justify-center bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-sm rounded-full px-6 py-2.5 shadow-lg hover:shadow-xl hover:scale-105 transition-all"
    >
      Book accommodation
      <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  </div>
);

/**
 * MIRI only, optional. Shown once the participation dates are approved.
 * Lets the student share passport and flight details and say how they will handle accommodation.
 */
const TravelDetailsSection = ({ applicationStatus, onSuccess }) => {
  const saved = applicationStatus?.travelDetails || null;
  const [editing, setEditing] = useState(!saved);
  const [form, setForm] = useState(() => buildForm(saved));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.arrivalDateTime && form.departureDateTime && form.departureDateTime <= form.arrivalDateTime) {
      setError('Departure must be after arrival.');
      return;
    }
    setSaving(true);
    try {
      await api.put('/application/travel-details', {
        ...form,
        passportExpiryDate: fromDateInput(form.passportExpiryDate),
        arrivalDateTime: fromJstInput(form.arrivalDateTime),
        departureDateTime: fromJstInput(form.departureDateTime),
        accommodationPlan: form.accommodationPlan || null,
      });
      setEditing(false);
      if (typeof onSuccess === 'function') onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Error saving travel details.');
    } finally {
      setSaving(false);
    }
  };

  const startEditing = () => {
    setForm(buildForm(saved));
    setError('');
    setEditing(true);
  };

  return (
    <div className="mt-8 pt-6 border-t border-white/40">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-lg font-bold text-gray-900">Travel Details</h3>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
          Optional
        </span>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Share your passport and flight information so the Mirai team can prepare for your arrival. You can fill in
        only what you have now and update it later.
      </p>

      <AccommodationOffer />

      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}

      {!editing && saved ? (
        <div className="p-4 rounded-xl bg-green-50/60 border border-green-200 space-y-4">
          <p className="text-sm font-medium text-green-800">Your travel details have been shared with the Mirai team.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SummaryRow label="Name on passport" value={saved.passportFullName} />
            <SummaryRow label="Nationality" value={saved.passportNationality} />
            <SummaryRow label="Passport number" value={saved.passportNumber} />
            <SummaryRow label="Passport expiry" value={saved.passportExpiryDate && formatDay(saved.passportExpiryDate)} />
            <SummaryRow
              label="Arrival"
              value={saved.arrivalDateTime && formatJst(saved.arrivalDateTime)}
            />
            <SummaryRow
              label="Arrival flight"
              value={[saved.arrivalFlight, saved.arrivalAirport].filter(Boolean).join(' · ')}
            />
            <SummaryRow
              label="Departure"
              value={saved.departureDateTime && formatJst(saved.departureDateTime)}
            />
            <SummaryRow
              label="Departure flight"
              value={[saved.departureFlight, saved.departureAirport].filter(Boolean).join(' · ')}
            />
            <SummaryRow label="Accommodation" value={ACCOMMODATION_LABELS[saved.accommodationPlan]} />
            <SummaryRow label="Notes" value={saved.notes} />
          </div>
          <button
            type="button"
            onClick={startEditing}
            className="inline-flex items-center justify-center bg-white border border-gray-300 text-gray-800 font-semibold text-sm rounded-full px-6 py-2.5 hover:bg-gray-50 transition-all"
          >
            Edit travel details
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <fieldset className="space-y-4">
            <legend className="text-sm font-bold text-gray-800 mb-2">Passport</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full name (as on passport)">
                <input type="text" maxLength={120} value={form.passportFullName} onChange={update('passportFullName')} className={inputClass} />
              </Field>
              <Field label="Nationality">
                <input type="text" maxLength={80} value={form.passportNationality} onChange={update('passportNationality')} className={inputClass} />
              </Field>
              <Field label="Passport number">
                <input type="text" maxLength={40} value={form.passportNumber} onChange={update('passportNumber')} className={inputClass} />
              </Field>
              <Field label="Expiry date">
                <input type="date" value={form.passportExpiryDate} onChange={update('passportExpiryDate')} className={inputClass} />
              </Field>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-sm font-bold text-gray-800 mb-2">Flights (times in Japan time)</legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Arrival in Japan">
                <input type="datetime-local" value={form.arrivalDateTime} onChange={update('arrivalDateTime')} className={inputClass} />
              </Field>
              <Field label="Arrival airport">
                <input type="text" maxLength={80} placeholder="e.g. Narita (NRT)" value={form.arrivalAirport} onChange={update('arrivalAirport')} className={inputClass} />
              </Field>
              <Field label="Airline and flight number">
                <input type="text" maxLength={40} placeholder="e.g. JL 61" value={form.arrivalFlight} onChange={update('arrivalFlight')} className={inputClass} />
              </Field>
              <Field label="Departure from Japan">
                <input type="datetime-local" value={form.departureDateTime} onChange={update('departureDateTime')} className={inputClass} />
              </Field>
              <Field label="Departure airport">
                <input type="text" maxLength={80} placeholder="e.g. Haneda (HND)" value={form.departureAirport} onChange={update('departureAirport')} className={inputClass} />
              </Field>
              <Field label="Airline and flight number">
                <input type="text" maxLength={40} value={form.departureFlight} onChange={update('departureFlight')} className={inputClass} />
              </Field>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-sm font-bold text-gray-800 mb-2">Accommodation</legend>
            <select value={form.accommodationPlan} onChange={update('accommodationPlan')} className={inputClass}>
              <option value="">Select an option</option>
              {Object.entries(ACCOMMODATION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </fieldset>

          <Field label="Anything else we should know? (optional)">
            <textarea rows={3} maxLength={1000} value={form.notes} onChange={update('notes')} className={inputClass} />
          </Field>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-sm rounded-full px-6 py-2.5 shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Share travel details'}
            </button>
            {saved && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={saving}
                className="inline-flex items-center justify-center bg-white border border-gray-300 text-gray-800 font-semibold text-sm rounded-full px-6 py-2.5 hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
};

export default TravelDetailsSection;
