/** USD 250 program registration fee (matches acceptance letter / invoice terms). */
export const REGISTRATION_FEE_USD = 250;
export const REGISTRATION_FEE_CENTS = REGISTRATION_FEE_USD * 100;

/**
 * True when the applicant has paid the registration fee, or was already in the
 * invoice flow before Stripe was introduced (grandfathered).
 */
export function isRegistrationFeePaid(application) {
  if (!application) return false;
  if (application.registrationFeeStatus === "paid") return true;
  if (application.invoiceStatus === "pending" || application.invoiceStatus === "approved") {
    return true;
  }
  return false;
}
