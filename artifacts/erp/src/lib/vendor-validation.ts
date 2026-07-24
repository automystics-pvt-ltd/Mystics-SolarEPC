/**
 * Shared vendor validation rules.
 * All string inputs should be trimmed before testing.
 */

// Indian GSTIN: 2-digit state code + 5 alpha + 4 digits + 1 alpha + 1 [1-9A-Z] + Z + 1 [0-9A-Z]
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
// PAN: 5 alpha + 4 digits + 1 alpha
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
// Indian mobile: starts with 6–9, exactly 10 digits
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

/** Core vendor fields — used on both create and edit */
export function validateVendorCore(form: Record<string, any>): VendorErrors {
  const errors: VendorErrors = {};

  /* Name */
  const name = (form.name ?? "").trim();
  if (!name)
    errors.name = "Vendor name is required to create a record.";
  else if (name.length < 2)
    errors.name = "Vendor name is too short — please enter at least 2 characters.";

  /* GSTIN — optional, validated only when provided */
  if (form.gstin?.trim()) {
    const g = form.gstin.trim().toUpperCase();
    if (g.length !== 15)
      errors.gstin = `GSTIN must be exactly 15 characters — you've entered ${g.length}. Example: 27AABCU9603R1ZX`;
    else if (!GSTIN_REGEX.test(g))
      errors.gstin = "GSTIN format is incorrect. It should follow: 2-digit state code + PAN (10 chars) + 3 check characters. Example: 27AABCU9603R1ZX";
  }

  /* PAN — optional, validated only when provided */
  if (form.pan?.trim()) {
    const p = form.pan.trim().toUpperCase();
    if (p.length !== 10)
      errors.pan = `PAN must be exactly 10 characters — you've entered ${p.length}. Example: AABCU9603R`;
    else if (!PAN_REGEX.test(p))
      errors.pan = "PAN format is incorrect. It should be 5 letters, 4 digits, then 1 letter. Example: AABCU9603R";
  }

  /* Primary email */
  if (form.primaryEmail?.trim()) {
    if (!EMAIL_REGEX.test(form.primaryEmail.trim()))
      errors.primaryEmail = "That doesn't look like a valid email address. Please use the format: name@company.com";
  }

  /* Primary phone */
  if (form.primaryPhone?.trim()) {
    const ph = form.primaryPhone.replace(/[\s\-()]/g, "");
    if (ph.length !== 10)
      errors.primaryPhone = `Mobile number must be exactly 10 digits — you've entered ${ph.length}.`;
    else if (!PHONE_REGEX.test(ph))
      errors.primaryPhone = "Please enter a valid Indian mobile number. It should start with 6, 7, 8, or 9 and be 10 digits long.";
  }

  return errors;
}

/** Additional bank & billing fields — used in the detail edit form */
export function validateVendorFull(form: Record<string, any>): VendorErrors {
  const errors = validateVendorCore(form);

  /* IFSC */
  if (form.bankIfsc?.trim()) {
    const ifsc = form.bankIfsc.trim().toUpperCase();
    if (ifsc.length !== 11)
      errors.bankIfsc = `IFSC code must be exactly 11 characters — you've entered ${ifsc.length}. Example: SBIN0001234`;
    else if (!IFSC_REGEX.test(ifsc))
      errors.bankIfsc = "IFSC code format is incorrect. It should be 4 bank letters, a zero, then 6 alphanumeric characters. Example: SBIN0001234";
  }

  /* Bank account number */
  if (form.bankAccountNumber?.trim()) {
    const acc = form.bankAccountNumber.trim().replace(/\s/g, "");
    if (!BANK_ACCOUNT_REGEX.test(acc))
      errors.bankAccountNumber = "Account number must be between 9 and 18 digits. Please check and re-enter.";
  }

  /* Pincode */
  if (form.billingPincode?.trim()) {
    const pin = form.billingPincode.trim();
    if (pin.length !== 6)
      errors.billingPincode = `PIN code must be exactly 6 digits — you've entered ${pin.length}.`;
    else if (!PINCODE_REGEX.test(pin))
      errors.billingPincode = "Please enter a valid 6-digit Indian PIN code (e.g. 110001). It should not start with 0.";
  }

  return errors;
}

/** Contact-level validation */
export function validateContact(form: Record<string, any>): VendorErrors {
  const errors: VendorErrors = {};

  const name = (form.name ?? "").trim();
  if (!name)
    errors.name = "Contact name is required.";
  else if (name.length < 2)
    errors.name = "Name is too short — please enter at least 2 characters.";

  if (form.email?.trim() && !EMAIL_REGEX.test(form.email.trim()))
    errors.email = "That doesn't look like a valid email. Please use the format: name@company.com";

  if (form.phone?.trim()) {
    const ph = form.phone.replace(/[\s\-()]/g, "");
    if (ph.length !== 10)
      errors.phone = `Mobile number must be exactly 10 digits — you've entered ${ph.length}.`;
    else if (!PHONE_REGEX.test(ph))
      errors.phone = "Please enter a valid Indian mobile number starting with 6, 7, 8, or 9.";
  }

  return errors;
}

export function hasErrors(errors: VendorErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Human-readable field labels for error summaries */
export const FIELD_LABELS: Record<string, string> = {
  name:              "Vendor Name",
  gstin:             "GSTIN",
  pan:               "PAN",
  primaryEmail:      "Primary Email",
  primaryPhone:      "Primary Phone",
  bankIfsc:          "IFSC Code",
  bankAccountNumber: "Account Number",
  billingPincode:    "PIN Code",
};
