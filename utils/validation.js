function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidRating(val) {
  if (val === undefined || val === null) return false;
  const num = Number(val);
  return Number.isInteger(num) && num >= 1 && num <= 5;
}

module.exports = {
  isValidEmail,
  isValidRating
};
