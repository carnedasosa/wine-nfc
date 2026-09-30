function maintenance(res) {
  if (process.env.MAINTENANCE_MODE !== 'true') return false;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Retry-After', '30');
  res.status(503).json({ code: 'MAINTENANCE', message: 'Breve pausa tecnica. Riprova tra poco.', fields: {} });
  return true;
}
module.exports = { maintenance };
