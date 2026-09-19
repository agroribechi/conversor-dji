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

const PROFILES = {
  mini3: { Make: 'DJI', Model: 'Mavic 3M', RtkFlag: '1', GimbalPitchDegree: '-90' },
  neo: { Make: 'DJI', Model: 'Mavic 3M', RtkFlag: '1', GimbalPitchDegree: '-90' },
  mavicpro: { Make: 'DJI', Model: 'Mavic 3M', RtkFlag: '1', GimbalPitchDegree: '-90' },
  default: { Make: 'DJI', Model: 'Mavic 3M', RtkFlag: '1' }
};

// Helper para extrair metadados EXIF usando ExifTool nativo
const getExifData = (filePath) => {
  return new Promise((resolve) => {
    const exiftoolBinary = fs.existsSync(path.join(BASE_PATH, 'exiftool.exe')) 
      ? path.join(BASE_PATH, 'exiftool.exe') 
      : 'exiftool';
    
    const args = ['-n', '-j', '-GPSLatitude', '-GPSLongitude', '-GPSAltitude', '-AbsoluteAltitude', '-RelativeAltitude', '-GimbalPitchDegree', '-RtkFlag', filePath];
    const child = spawn(exiftoolBinary, args);
    
    let stdout = '';
    child.stdout.on('data', (data) => stdout += data.toString());
    child.on('close', () => {
      try {
        const data = JSON.parse(stdout);
        resolve(data[0] || {});
      } catch (e) {
        resolve({});
      }
    });
    child.on('error', () => resolve({}));
  });
};

// Rota de Health Check
app.get('/', (req, res) => {
  res.json({ message: 'Backend DJI Converter Online!', mode: 'exiftool-engine', status: 'running' });
});
app.get('/api/health', (req, res) => {
  res.json({ message: 'Backend DJI Converter Online!', mode: 'exiftool-engine', status: 'running' });
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

// AUTORIZAÇÃO CLIENT-SIDE
app.post('/api/process/authorize', authenticateToken, async (req, res) => {
  const { fileCount, profile } = req.body;
  const count = parseInt(fileCount, 10);

  if (!count || count <= 0) {
    return res.status(400).json({ error: 'Quantidade de arquivos inválida.' });
  }

  if (req.user.role !== 'admin' && req.user.credits < count) {
    return res.status(403).json({ 
      error: `Saldo insuficiente! Você possui ${req.user.credits} créditos, mas tentou converter ${count} fotos. Adquira mais créditos para continuar.`,
      creditsShortage: true,
      userCredits: req.user.credits,
      requiredCredits: count
    });
  }

  try {
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

// ROTA DE UPLOAD E CONVERSÃO VIA EXIFTOOL ENGINE (100% GARANTIDA PARA DJI TERRA E SMART FARM)
app.post('/upload', authenticateToken, upload.array('files'), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  }

  const fileCount = req.files.length;

  if (req.user.role !== 'admin' && req.user.credits < fileCount) {
    return res.status(403).json({ 
      error: `Saldo insuficiente! Você possui ${req.user.credits} créditos, mas enviou ${fileCount} fotos. Adquira mais créditos para continuar.`,
      creditsShortage: true,
      userCredits: req.user.credits,
      requiredCredits: fileCount
    });
  }

  const profileName = req.query.profile || 'default';
  const profile = PROFILES[profileName] || PROFILES.default;
  const sessionId = uuidv4();
  const sessionDir = path.join(TEMP_BASE, sessionId);
  const outputDir = path.join(sessionDir, 'output');

  console.log(`\n[${new Date().toLocaleTimeString()}] Conversão ExifTool iniciada por ${req.user.email} (${fileCount} fotos)`);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const exiftoolBinary = fs.existsSync(path.join(BASE_PATH, 'exiftool.exe')) 
    ? path.join(BASE_PATH, 'exiftool.exe') 
    : 'exiftool';

  const processSingleFile = async (file) => {
    const originalName = file.originalname;
    const tempPath = file.path;
    const finalPath = path.join(outputDir, originalName);
    
    try {
      const originalExif = await getExifData(tempPath);
      
      const args = ['-overwrite_original', '-n'];
      for (const [tag, val] of Object.entries(profile)) {
        args.push(`-${tag}=${val}`);
      }
      args.push('-XMP-drone-dji:AbsoluteAltitude<GPSAltitude');
      args.push('-XMP-drone-dji:RelativeAltitude<GPSAltitude');
      args.push('-XMP-drone-dji:GpsLatitude<GPSLatitude');
      args.push('-XMP-drone-dji:GpsLongitude<GPSLongitude');
      args.push('-XMP-drone-dji:GimbalPitchDegree=-90');
      args.push('-XMP-drone-dji:RtkFlag=1');
      args.push(tempPath);

      await new Promise((resolve, reject) => {
        const child = spawn(exiftoolBinary, args);
        let stderr = '';
        child.stderr.on('data', (data) => stderr += data.toString());
        child.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(stderr || `ExifTool falhou com código ${code}`));
        });
        child.on('error', reject);
      });

      fs.renameSync(tempPath, finalPath);
      const convertedExif = await getExifData(finalPath);
      
      return { 
        filename: originalName, 
        status: 'success', 
        original_exif: originalExif,
        converted_exif: convertedExif
      };
    } catch (error) {
      return { 
        filename: originalName, 
        status: 'error', 
        message: error.message 
      };
    }
  };

  const results = [];
  for (const file of req.files) {
    const result = await processSingleFile(file);
    results.push(result);
  }

  const successCount = results.filter(r => r.status === 'success').length;

  if (successCount > 0 && req.user.role !== 'admin') {
    await dbRun('UPDATE users SET credits = credits - ? WHERE id = ?', [successCount, req.user.id]);
    await dbRun('INSERT INTO conversions (user_id, file_count, profile) VALUES (?, ?, ?)', [req.user.id, successCount, profileName]);
  }

  const updatedUser = await dbGet('SELECT credits FROM users WHERE id = ?', [req.user.id]);
  
  finishProcessing(res, sessionId, outputDir, results, updatedUser ? updatedUser.credits : req.user.credits);
});

const finishProcessing = (res, sessionId, outputDir, results, remainingCredits) => {
  const successCount = results.filter(r => r.status === 'success').length;
  
  if (successCount === 0) {
    return res.status(500).json({ error: 'Erro ao converter arquivos.', details: results });
  }

  const zipFile = path.join(TEMP_BASE, `${sessionId}_converted.zip`);
  const outputStream = fs.createWriteStream(zipFile);
  const archive = archiver('zip', { zlib: { level: 9 } });

  outputStream.on('close', () => {
    res.json({ 
      session_id: sessionId, 
      results, 
      download_url: `/download/${sessionId}`,
      remaining_credits: remainingCredits
    });
  });

  archive.pipe(outputStream);
  archive.directory(outputDir, false);
  archive.finalize();
};

app.get('/download/:session_id', (req, res) => {
  const zipPath = path.join(TEMP_BASE, `${req.params.session_id}_converted.zip`);
  if (fs.existsSync(zipPath)) {
    res.download(zipPath);
  } else {
    res.status(404).send('Arquivo ZIP expirou ou não foi encontrado.');
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
  console.log(`Motor: ExifTool Engine`);
  console.log(`=========================================\n`);
});
