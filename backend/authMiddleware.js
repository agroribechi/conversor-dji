const jwt = require('jsonwebtoken');
const { dbGet } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'DJI_SECRET_KEY_2026_SMART_FARM';

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Acesso negado. Token de autenticação não fornecido.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [decoded.userId]);

    if (!user) {
      return res.status(401).json({ error: 'Usuário não encontrado.' });
    }

    if (user.status === 'blocked') {
      return res.status(403).json({ error: 'Esta conta foi bloqueada pelo administrador.' });
    }

    // TRAVA ANTI-COMPARTILHAMENTO: Checa se a sessão ativa bate com a do Token
    if (user.current_session_id !== decoded.sessionId) {
      return res.status(401).json({ 
        error: 'Sessão encerrada: Sua conta foi conectada em outro computador ou navegador.',
        sessionInvalidated: true 
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token inválido ou expirado.' });
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }
  next();
};

module.exports = {
  JWT_SECRET,
  authenticateToken,
  requireAdmin
};
