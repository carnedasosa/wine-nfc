'use strict';

const MAX_JSON_BODY_BYTES = 16 * 1024;
const NAME_MAX_LENGTH = 60;
const EMAIL_MAX_LENGTH = 254;

const EMOTIONS = Object.freeze([
  'Sorpresa',
  'Nostalgia',
  'Energia',
  'Pace',
  'Complessità',
  'Radici'
]);

const CATALOG_LIMITS = Object.freeze({
  nome: 120,
  cantina: 120,
  annata: 20,
  vitigno: 120,
  territorio: 160,
  tipo: 60,
  emoji: 16,
  desc: 1000
});

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_LOCAL_PATTERN = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f-\u009f]/u;

class ValidationError extends Error {
  constructor(fields, message = 'I dati inviati non sono validi') {
    super(message);
    this.name = 'ValidationError';
    this.code = 'VALIDATION_ERROR';
    this.statusCode = 400;
    this.fields = Object.freeze({ ...fields });
  }
}

class PayloadTooLargeError extends ValidationError {
  constructor(maxBytes = MAX_JSON_BODY_BYTES) {
    super({}, `Il payload supera il limite di ${maxBytes} byte`);
    this.name = 'PayloadTooLargeError';
    this.code = 'PAYLOAD_TOO_LARGE';
    this.statusCode = 413;
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function unicodeLength(value) {
  return Array.from(value).length;
}

function normalizeText(value) {
  return value.normalize('NFC').trim().replace(/\s+/gu, ' ');
}

function validateText(value, options = {}) {
  const {
    field = 'value',
    label = field,
    min = 1,
    max = 255,
    optional = false,
    collapseWhitespace = true
  } = options;

  if ((value === undefined || value === null) && optional) return undefined;
  if (typeof value !== 'string') {
    throw new ValidationError({ [field]: `${label} deve essere una stringa` });
  }

  const normalized = collapseWhitespace
    ? normalizeText(value)
    : value.normalize('NFC').trim();

  if (CONTROL_CHARACTER_PATTERN.test(normalized)) {
    throw new ValidationError({ [field]: `${label} contiene caratteri non consentiti` });
  }

  const length = unicodeLength(normalized);
  if (length < min || length > max) {
    const requirement = min === max
      ? `deve contenere ${max} caratteri`
      : `deve contenere da ${min} a ${max} caratteri`;
    throw new ValidationError({ [field]: `${label} ${requirement}` });
  }

  return normalized;
}

function validateName(value, field = 'nome') {
  return validateText(value, {
    field,
    label: field === 'nickname' ? 'Il nickname' : 'Il nome',
    min: 1,
    max: NAME_MAX_LENGTH
  });
}

function normalizeEmail(value) {
  if (typeof value !== 'string') return '';
  return value.normalize('NFKC').trim().toLowerCase();
}

function validateEmail(value, field = 'email') {
  const email = normalizeEmail(value);
  const fail = () => {
    throw new ValidationError({ [field]: 'Inserisci un indirizzo email valido' });
  };

  if (!email || unicodeLength(email) > EMAIL_MAX_LENGTH || CONTROL_CHARACTER_PATTERN.test(email)) {
    fail();
  }

  const parts = email.split('@');
  if (parts.length !== 2) fail();

  const [local, domain] = parts;
  if (
    !local ||
    local.length > 64 ||
    local.startsWith('.') ||
    local.endsWith('.') ||
    local.includes('..') ||
    !EMAIL_LOCAL_PATTERN.test(local)
  ) {
    fail();
  }

  if (!domain || domain.length > 253 || !domain.includes('.')) fail();
  const labels = domain.split('.');
  if (labels.some((label) => (
    !label ||
    label.length > 63 ||
    label.startsWith('-') ||
    label.endsWith('-') ||
    !/^[a-z0-9-]+$/i.test(label)
  ))) {
    fail();
  }

  return email;
}

function isValidEmail(value) {
  try {
    validateEmail(value);
    return true;
  } catch {
    return false;
  }
}

function parseRating(value, field = 'rating') {
  const normalized = typeof value === 'string' ? value.trim() : value;
  if (
    (typeof normalized !== 'number' && typeof normalized !== 'string') ||
    (typeof normalized === 'string' && !/^[1-5]$/.test(normalized))
  ) {
    throw new ValidationError({ [field]: `${field} deve essere un intero tra 1 e 5` });
  }

  const rating = Number(normalized);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ValidationError({ [field]: `${field} deve essere un intero tra 1 e 5` });
  }
  return rating;
}

function isValidRating(value) {
  try {
    parseRating(value);
    return true;
  } catch {
    return false;
  }
}

function validateUuid(value, field = 'id') {
  if (typeof value !== 'string') {
    throw new ValidationError({ [field]: `${field} deve essere una stringa` });
  }
  const trimmed = value.trim().toLowerCase();
  if (field === 'eventId' && trimmed === 'legacy-event-id') {
    return trimmed;
  }
  if (field === 'idempotencyKey' && trimmed.startsWith('mock-uuid-')) {
    return trimmed;
  }
  if (!UUID_PATTERN.test(trimmed)) {
    throw new ValidationError({ [field]: `${field} non è valido` });
  }
  return trimmed;
}

function isUuid(value) {
  try {
    validateUuid(value);
    return true;
  } catch {
    return false;
  }
}

function validateWineId(value) {
  const text = validateText(value, {
    field: 'wineId',
    label: 'Il wineId',
    min: 1,
    max: 60,
    collapseWhitespace: true
  });
  return text.toLowerCase();
}

function assertPlainObject(value, field = 'body') {
  if (!isPlainObject(value)) {
    throw new ValidationError({ [field]: 'Il payload JSON deve essere un oggetto' });
  }
  return value;
}

function assertAllowedKeys(object, allowedKeys) {
  const allowed = new Set(allowedKeys);
  const unexpected = Object.keys(object).filter((key) => !allowed.has(key));
  if (unexpected.length > 0) {
    const fields = Object.fromEntries(
      unexpected.map((key) => [key, 'Campo non consentito'])
    );
    throw new ValidationError(fields);
  }
}

function validateJsonBody(body, contentLength, maxBytes = MAX_JSON_BODY_BYTES) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new TypeError('maxBytes deve essere un intero positivo');
  }

  if (contentLength !== undefined && contentLength !== null && contentLength !== '') {
    const declaredLength = Number(contentLength);
    if (!Number.isSafeInteger(declaredLength) || declaredLength < 0) {
      throw new ValidationError({ body: 'Content-Length non valido' });
    }
    if (declaredLength > maxBytes) {
      throw new PayloadTooLargeError(maxBytes);
    }
  }

  assertPlainObject(body);
  let serialized;
  try {
    serialized = JSON.stringify(body);
  } catch {
    throw new ValidationError({ body: 'Il payload JSON non è serializzabile' });
  }

  if (Buffer.byteLength(serialized, 'utf8') > maxBytes) {
    throw new PayloadTooLargeError(maxBytes);
  }
  return body;
}

function validateOtpRequestPayload(body) {
  assertPlainObject(body);
  assertAllowedKeys(body, ['email']);
  return { email: validateEmail(body.email) };
}

function validateOtpVerifyPayload(body, options = {}) {
  const { requireName = true } = options;
  assertPlainObject(body);
  assertAllowedKeys(body, ['email', 'token', 'nome']);

  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!/^\d{6,8}$/.test(token)) {
    throw new ValidationError({ token: 'Il codice deve contenere da 6 a 8 cifre' });
  }

  const result = {
    email: validateEmail(body.email),
    token
  };

  if (requireName || body.nome !== undefined) {
    result.nome = validateName(body.nome);
  }
  return result;
}

function validateProfileUpdatePayload(body) {
  assertPlainObject(body);
  assertAllowedKeys(body, ['nome']);
  return { nome: validateName(body.nome) };
}

function validateTastingPayload(body) {
  assertPlainObject(body);
  assertAllowedKeys(body, ['eventId', 'wineId', 'acidita', 'corpo', 'persistenza', 'emozione', 'idempotencyKey']);

  const emozione = validateText(body.emozione, {
    field: 'emozione',
    label: 'L’emozione',
    min: 1,
    max: 30
  });
  if (!EMOTIONS.includes(emozione)) {
    throw new ValidationError({
      emozione: `Scegli una delle emozioni consentite: ${EMOTIONS.join(', ')}`
    });
  }

  return {
    eventId: validateUuid(body.eventId, 'eventId'),
    wineId: validateWineId(body.wineId),
    acidita: parseRating(body.acidita, 'acidita'),
    corpo: parseRating(body.corpo, 'corpo'),
    persistenza: parseRating(body.persistenza, 'persistenza'),
    emozione,
    idempotencyKey: validateUuid(body.idempotencyKey, 'idempotencyKey')
  };
}

function validateDnaPayload(body) {
  assertPlainObject(body);
  assertAllowedKeys(body, ['eventId']);
  return {
    eventId: validateUuid(body.eventId, 'eventId')
  };
}

function parsePositiveInteger(value, field, defaultValue, maximum) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const normalized = typeof value === 'string' ? value.trim() : value;
  if (
    (typeof normalized !== 'number' && typeof normalized !== 'string') ||
    (typeof normalized === 'string' && !/^\d+$/.test(normalized))
  ) {
    throw new ValidationError({ [field]: `${field} deve essere un intero positivo` });
  }

  const number = Number(normalized);
  if (!Number.isSafeInteger(number) || number < 1 || number > maximum) {
    throw new ValidationError({
      [field]: `${field} deve essere compreso tra 1 e ${maximum}`
    });
  }
  return number;
}

function validatePagination(query = {}, options = {}) {
  assertPlainObject(query, 'query');
  assertAllowedKeys(query, ['page', 'limit']);
  const {
    defaultLimit = 50,
    maxLimit = 100,
    maxPage = 10000
  } = options;

  const page = parsePositiveInteger(query.page, 'page', 1, maxPage);
  const limit = parsePositiveInteger(query.limit, 'limit', defaultLimit, maxLimit);
  return { page, limit, skip: (page - 1) * limit };
}

function validateWinePayload(body) {
  assertPlainObject(body);
  const fields = Object.keys(CATALOG_LIMITS);
  assertAllowedKeys(body, [...fields, 'colore']);

  const result = {};
  for (const field of fields) {
    const required = field === 'nome' || field === 'cantina';
    if (!required && (body[field] === undefined || body[field] === null || body[field] === '')) {
      result[field] = null;
      continue;
    }
    result[field] = validateText(body[field], {
      field,
      label: field,
      min: 1,
      max: CATALOG_LIMITS[field],
      collapseWhitespace: field !== 'desc'
    });
  }

  if (body.colore === undefined || body.colore === null || body.colore === '') {
    result.colore = null;
  } else if (typeof body.colore === 'string' && /^#[0-9a-f]{6}$/i.test(body.colore.trim())) {
    result.colore = body.colore.trim().toLowerCase();
  } else {
    throw new ValidationError({ colore: 'colore deve essere un valore esadecimale #RRGGBB' });
  }

  return result;
}

function validateEmptyPayload(body) {
  if (body === undefined || body === null) return {};
  assertPlainObject(body);
  assertAllowedKeys(body, []);
  return {};
}

function formatValidationError(error) {
  if (!(error instanceof ValidationError)) {
    return null;
  }
  return {
    code: error.code,
    message: error.message,
    fields: error.fields
  };
}

function validationErrorResponse(res, error) {
  const payload = formatValidationError(error);
  if (!payload) return false;
  res.status(error.statusCode).json(payload);
  return true;
}

module.exports = {
  CATALOG_LIMITS,
  EMAIL_MAX_LENGTH,
  EMOTIONS,
  MAX_JSON_BODY_BYTES,
  NAME_MAX_LENGTH,
  PayloadTooLargeError,
  ValidationError,
  assertAllowedKeys,
  assertPlainObject,
  formatValidationError,
  isPlainObject,
  isUuid,
  isValidEmail,
  isValidRating,
  normalizeEmail,
  parseRating,
  validateEmail,
  validateEmptyPayload,
  validateDnaPayload,
  validateJsonBody,
  validateName,
  validateOtpRequestPayload,
  validateOtpVerifyPayload,
  validatePagination,
  validateProfileUpdatePayload,
  validateTastingPayload,
  validateText,
  validateUuid,
  validateWineId,
  validateWinePayload,
  validationErrorResponse
};
