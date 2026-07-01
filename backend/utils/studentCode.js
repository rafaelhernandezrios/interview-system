/**
 * MIRI registration / student code (e.g. MIRI-2026-01-049).
 * Not the auto-generated digitalId from signup (e.g. MIRI-2026-4).
 */
export function isMiriStudentCode(value) {
  if (!value || typeof value !== "string") return false;
  return /^MIRI-2026/i.test(value.trim());
}

export function resolveStudentCode(user, application = null) {
  if (!user) return null;

  const candidates = [
    application?.registrationCode,
    application?.promotionalCode,
  ]
    .map((value) => value?.trim())
    .filter(Boolean);

  for (const code of candidates) {
    if (isMiriStudentCode(code)) return code;
  }

  // Legacy: some CSV imports stored the full code in user.digitalId
  const legacy = user.digitalId?.trim();
  if (/^MIRI-2026-\d{2}-\d+$/i.test(legacy)) return legacy;

  return null;
}
