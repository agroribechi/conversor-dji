const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { dbRun, dbGet, dbAll } = require('./db');
const { JWT_SECRET, authenticateToken, requireAdmin } = require('./authMiddleware');
const paymentRoutes = require('./paymentRoutes');

const app = express();
app.use(cors());
app.use(express.json());

const BASE_PATH = process.cwd();
const TEMP_BASE = path.join(BASE_PATH, 'temp_processing');
const UPLOAD_DIR = path.join(TEMP_BASE, 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const upload = multer({ dest: UPLOAD_DIR });

// Rota de Health Check
app.get('/', (req, res) => {
  res.json({ message: 'Backend DJI Converter Online!', mode: 'client-side-auth', status: 'running' });
});

// ROTAS DE AUTENTICAÇÃO E SESSÃO
app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
  }

  try {
    const existing = await dbGet('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (existing) {
      return res.status(400).json({ error: 'E-mail já cadastrado.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const sessionId = uuidv4();
    const result = await dbRun(
      'INSERT INTO users (email, password_hash, role, credits, status, current_session_id) VALUES (?, ?, "user", 50, "active", ?)',
      [email.toLowerCase().trim(), hashedPassword, sessionId]
    );

    const token = jwt.sign({ userId: result.id, sessionId }, JWT_SECRET, { expiresIn: '7d' });
    const user = await dbGet('SELECT id, email, role, credits, status FROM users WHERE id = ?', [result.id]);

    res.json({ token, user });
  } catch (err) {
    console.error('[Register Error]', err);
    res.status(500).json({ error: 'Erro ao cadastrar usuário.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
  }

  try {
    const user = await dbGet('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (!user) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    if (user.status === 'blocked') {
      return res.status(403).json({ error: 'Sua conta está bloqueada pelo administrador.' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    // TRAVA ANTI-COMPARTILHAMENTO: Gera novo sessionId que invalida sessões antigas
    const newSessionId = uuidv4();
    await dbRun('UPDATE users SET current_session_id = ? WHERE id = ?', [newSessionId, user.id]);

    const token = jwt.sign({ userId: user.id, sessionId: newSessionId }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        credits: user.credits,
        status: user.status
      }
    });
  } catch (err) {
    console.error('[Login Error]', err);
    res.status(500).json({ error: 'Erro ao efetuar login.' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      credits: req.user.credits,
      status: req.user.status
    }
  });
});

// AUTORIZAÇÃO DE PROCESSAMENTO CLIENT-SIDE & DEBITO DE CRÉDITOS
app.post('/api/process/authorize', authenticateToken, async (req, res) => {
  const { fileCount, profile } = req.body;
  const count = parseInt(fileCount, 10);

  if (!count || count <= 0) {
    return res.status(400).json({ error: 'Quantidade de arquivos inválida.' });
  }

  // Verifica saldo de créditos
  if (req.user.role !== 'admin' && req.user.credits < count) {
    return res.status(403).json({ 
      error: `Saldo insuficiente! Você possui ${req.user.credits} créditos, mas tentou converter ${count} fotos. Adquira mais créditos para continuar.`,
      creditsShortage: true,
      userCredits: req.user.credits,
      requiredCredits: count
    });
  }

  try {
    // Debita os créditos no banco se não for admin
    if (req.user.role !== 'admin') {
      await dbRun('UPDATE users SET credits = credits - ? WHERE id = ?', [count, req.user.id]);
      await dbRun('INSERT INTO conversions (user_id, file_count, profile) VALUES (?, ?, ?)', [req.user.id, count, profile || 'default']);
    }

    const updatedUser = await dbGet('SELECT credits FROM users WHERE id = ?', [req.user.id]);

    res.json({
      authorized: true,
      fileCount: count,
      remainingCredits: updatedUser ? updatedUser.credits : req.user.credits
    });
  } catch (err) {
    console.error('[Authorize Error]', err);
    res.status(500).json({ error: 'Erro ao autorizar conversão.' });
  }
});

// ROTAS DO PAINEL ADMIN
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await dbAll('SELECT id, email, role, credits, status, current_session_id, created_at FROM users ORDER BY id DESC');
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar usuários.' });
  }
});

app.post('/api/admin/users/:id/credits', authenticateToken, requireAdmin, async (req, res) => {
  const { credits } = req.body;
  const userId = req.params.id;

  try {
    await dbRun('UPDATE users SET credits = ? WHERE id = ?', [parseInt(credits, 10), userId]);
    res.json({ message: 'Créditos atualizados com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar créditos.' });
  }
});

app.post('/api/admin/users/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  const { status } = req.body;
  const userId = req.params.id;

  try {
    await dbRun('UPDATE users SET status = ? WHERE id = ?', [status, userId]);
    res.json({ message: `Status do usuário alterado para ${status}.` });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar status.' });
  }
});

// ROTAS DE PAGAMENTO PIX
app.use('/api/payments', paymentRoutes);

const PORT = 8000;
app.listen(PORT, () => {
  console.log(`\n=========================================`);
  console.log(`DJI CONVERTER BACKEND OPERACIONAL`);
  console.log(`Porta: ${PORT}`);
  console.log(`Modo: Client-Side Authorization Server`);
  console.log(`=========================================\n`);
});
