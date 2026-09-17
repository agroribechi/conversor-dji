const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { dbRun, dbGet } = require('./db');
const { authenticateToken } = require('./authMiddleware');

// Pacotes de Créditos Disponíveis
const CREDIT_PACKAGES = [
  { id: 'pkg_100', name: 'Pacote Start', credits: 100, price: 15.00, desc: 'Ideal para testes e pequenas áreas' },
  { id: 'pkg_500', name: 'Pacote Pro', credits: 500, price: 49.00, desc: 'Recomendado para mapeamento frequente' },
  { id: 'pkg_2000', name: 'Pacote Enterprise', credits: 2000, price: 149.00, desc: 'Para grande volume de hectares' }
];

router.get('/packages', (req, res) => {
  res.json({ packages: CREDIT_PACKAGES });
});

// Criar cobrança Pix
router.post('/create-pix', authenticateToken, async (req, res) => {
  const { packageId } = req.body;
  const pkg = CREDIT_PACKAGES.find(p => p.id === packageId);

  if (!pkg) {
    return res.status(400).json({ error: 'Pacote de créditos inválido.' });
  }

  const paymentId = uuidv4();
  const mockPixCopyPaste = `00020126580014br.gov.bcb.pix0136${paymentId}5204000053039865405${pkg.price.toFixed(2)}5802BR5920DJI SMART CONVERTER6009SAO PAULO62070503***6304`;

  try {
    await dbRun(
      `INSERT INTO transactions (user_id, amount, credits_added, payment_status, payment_id, pix_code) 
       VALUES (?, ?, ?, 'pending', ?, ?)`,
      [req.user.id, pkg.price, pkg.credits, paymentId, mockPixCopyPaste]
    );

    res.json({
      payment_id: paymentId,
      amount: pkg.price,
      credits: pkg.credits,
      pix_code: mockPixCopyPaste,
      status: 'pending'
    });
  } catch (err) {
    console.error('[Payment Error]', err);
    res.status(500).json({ error: 'Erro ao gerar Pix.' });
  }
});

// Simular Aprovação Automática / Webhook de Teste (Para teste no frontend)
router.post('/simulate-confirm', authenticateToken, async (req, res) => {
  const { payment_id } = req.body;

  try {
    const tx = await dbGet('SELECT * FROM transactions WHERE payment_id = ? AND user_id = ?', [payment_id, req.user.id]);
    if (!tx) {
      return res.status(404).json({ error: 'Transação não encontrada.' });
    }

    if (tx.payment_status === 'approved') {
      const user = await dbGet('SELECT credits FROM users WHERE id = ?', [req.user.id]);
      return res.json({ message: 'Pagamento já havia sido aprovado.', credits: user.credits });
    }

    // Atualiza transação
    await dbRun("UPDATE transactions SET payment_status = 'approved' WHERE payment_id = ?", [payment_id]);

    // Adiciona créditos ao usuário
    await dbRun("UPDATE users SET credits = credits + ? WHERE id = ?", [tx.credits_added, req.user.id]);

    const updatedUser = await dbGet('SELECT credits FROM users WHERE id = ?', [req.user.id]);

    res.json({ 
      success: true, 
      message: `Pagamento aprovado com sucesso! +${tx.credits_added} créditos adicionados.`,
      credits: updatedUser.credits 
    });
  } catch (err) {
    console.error('[Payment Confirm Error]', err);
    res.status(500).json({ error: 'Erro ao confirmar pagamento.' });
  }
});

module.exports = router;
