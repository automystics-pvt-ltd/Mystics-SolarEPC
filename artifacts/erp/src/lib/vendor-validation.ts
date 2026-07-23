/**
 * Shared vendor validation rules (used by both frontend forms and can be mirrored server-side).
 * All string inputs should be trimmed before testing.
 */

// Indian GSTIN: 2-digit state code + 5 alpha (PAN company letters) + 4 digits + 1 alpha + 1 [1-9A-Z] + Z + 1 [0-9A-Z]
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
// PAN: 5 alpha + 4 digits + 1 alpha
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
// Indian mobile: starts with 6-9, exactly 10 digits
export const PHONE_REGEX = /^[6-9]\d{9}$/;
// Basic email
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// IFSC: 4 alpha + literal 0 + 6 alphanumeric
export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
// Indian pincode: 6 digits, not starting with 0
export const PINCODE_REGEX = /^[1-9][0-9]{5}$/;
// Bank account: 9–18 digits
export const BANK_ACCOUNT_REGEX = /^\d{9,18}$/;

export type VendorErrors = Record<string, string>;

/** Core vendor fields validation — used for both create and edit */
export function validateVendorCore(form: Record<string, any>): VendorErrors {
  const errors: VendorErrors = {};

  // Name
  const name = (form.name ?? "").trim();
  if (!name) errors.name = "Vendor name is required";
  else if (name.length < 2) errors.name = "Name must be at least 2 characters";

  // GSTIN (optional, but if provided must match pattern)
  if (form.gstin?.trim()) {
    const g = form.gstin.trim().toUpperCase();
    if (!GSTIN_REGEX.test(g))
      errors.gstin = "Invalid GSTIN — expected format: 27AABCU9603R1ZX (15 chars)";
  }

  // PAN (optional, but if provided must match pattern)
  if (form.pan?.trim()) {
    const p = form.pan.trim().toUpperCase();
    if (!PAN_REGEX.test(p))
      errors.pan = "Invalid PAN — expected format: AABCU9603R (10 chars)";
  }

  // Primary email
  if (form.primaryEmail?.trim()) {
    if (!EMAIL_REGEX.test(form.primaryEmail.trim()))
      errors.primaryEmail = "Invalid email address";
  }

  // Primary phone — strip spaces, then check
  if (form.primaryPhone?.trim()) {
    const ph = form.primaryPhone.replace(/[\s\-\(\)]/g, "");
    if (!PHONE_REGEX.test(ph))
      errors.primaryPhone = "Enter a valid 10-digit Indian mobile number (starts 6–9)";
  }

  return errors;
}

/** Additional bank/billing fields validation — used in the detail edit form */
export function validateVendorFull(form: Record<string, any>): VendorErrors {
  const errors = validateVendorCore(form);

  // IFSC
  if (form.bankIfsc?.trim()) {
    const ifsc = form.bankIfsc.trim().toUpperCase();
    if (!IFSC_REGEX.test(ifsc))
      errors.bankIfsc = "Invalid IFSC code — expected format: SBIN0001234";
  }

  // Bank account number
  if (form.bankAccountNumber?.trim()) {
    const acc = form.bankAccountNumber.trim().replace(/\s/g, "");
    if (!BANK_ACCOUNT_REGEX.test(acc))
      errors.bankAccountNumber = "Account number must be 9–18 digits";
  }

  // Pincode
  if (form.billingPincode?.trim()) {
    if (!PINCODE_REGEX.test(form.billingPincode.trim()))
      errors.billingPincode = "Invalid pincode — must be 6 digits";
  }

  return errors;
}

/** Contact-level validation */
export function validateContact(form: Record<string, any>): VendorErrors {
  const errors: VendorErrors = {};

  const name = (form.name ?? "").trim();
  if (!name) errors.name = "Contact name is required";
  else if (name.length < 2) errors.name = "Name must be at least 2 characters";

  if (form.email?.trim() && !EMAIL_REGEX.test(form.email.trim()))
    errors.email = "Invalid email address";

  if (form.phone?.trim()) {
    const ph = form.phone.replace(/[\s\-\(\)]/g, "");
    if (!PHONE_REGEX.test(ph))
      errors.phone = "Enter a valid 10-digit Indian mobile number";
  }

  return errors;
}

export function hasErrors(errors: VendorErrors): boolean {
  return Object.keys(errors).length > 0;
}
