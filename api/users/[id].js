const prisma = require('../../lib/prisma');
const { withAuth } = require('../../lib/auth');
const {
  methodNotAllowed,
  sendJsonError,
  sendValidationError,
  setNoStore,
  validateRequestBody
} = require('../../lib/api-utils');
const {
  validateProfileUpdatePayload,
  validateUuid
} = require('../../utils/validation');

module.exports = withAuth(async function updateProfileHandler(req, res) {
  setNoStore(res);
  if (req.method !== 'PUT') return methodNotAllowed(res, 'PUT');

  let id;
  let input;
  try {
    id = validateUuid(
      (req.query && req.query.id) || (req.params && req.params.id),
      'id'
    );
    input = validateRequestBody(req, validateProfileUpdatePayload);
  } catch (error) {
    if (sendValidationError(res, error)) return undefined;
    return sendJsonError(res, 400, 'INVALID_REQUEST', 'Richiesta non valida');
  }

  if (id !== req.userId) {
    return sendJsonError(
      res,
      403,
      'FORBIDDEN_PROFILE_UPDATE',
      'Non puoi modificare questo profilo'
    );
  }

  try {
    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: { nome: input.nome },
      select: { id: true, nome: true, email: true }
    });
    return res.status(200).json(updated);
  } catch (error) {
    if (error && error.code === 'P2025') {
      return sendJsonError(res, 404, 'USER_NOT_FOUND', 'Utente non trovato');
    }
    console.error('Errore interno durante l’aggiornamento del profilo');
    return sendJsonError(res, 500, 'INTERNAL_ERROR', 'Errore interno del server');
  }
});
