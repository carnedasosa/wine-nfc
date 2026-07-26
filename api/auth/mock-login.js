const crypto = require('node:crypto');
const { linkVerifiedIdentity } = require('../../lib/user-account');
const { setSessionCookies } = require('../../lib/http-security');

module.exports = async function mockLoginHandler(req, res) {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ message: 'Not found' });
  }

  const authSubject = crypto.randomUUID();
  const mockToken = `mock_${authSubject}`;
  const identity = {
    id: authSubject,
    email: `test-${authSubject}@test.local`
  };

  try {
    const user = await linkVerifiedIdentity(identity, `Test User ${authSubject.substring(0, 4)}`);
    const session = {
      accessToken: mockToken,
      refreshToken: mockToken,
      expiresIn: 3600
    };
    
    const csrfToken = setSessionCookies(res, session);
    return res.status(200).json({ user, session, csrfToken });
  } catch (error) {
    console.error('Mock login error', error);
    return res.status(500).json({ error: 'Failed to create mock session' });
  }
};
