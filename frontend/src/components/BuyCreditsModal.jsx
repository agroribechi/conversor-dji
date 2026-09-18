import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/useAuth';
import { X, QrCode, Copy, CheckCircle2, Zap, Sparkles } from 'lucide-react';
import { API_BASE } from '../config/api';

export default function BuyCreditsModal({ onClose }) {
  const { refreshUser } = useAuth();
  const [packages, setPackages] = useState([]);
  const [selectedPkg, setSelectedPkg] = useState(null);
  const [pixData, setPixData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      const resp = await axios.get(`${API_BASE}/api/payments/packages`);
      setPackages(resp.data.packages);
      if (resp.data.packages.length > 0) {
        setSelectedPkg(resp.data.packages[1] || resp.data.packages[0]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const generatePix = async () => {
    if (!selectedPkg) return;
    setLoading(true);
    setSuccessMsg('');
    try {
      const resp = await axios.post(`${API_BASE}/api/payments/create-pix`, { packageId: selectedPkg.id });
      setPixData(resp.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const copyPixCode = () => {
    if (pixData?.pix_code) {
      navigator.clipboard.writeText(pixData.pix_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const simulatePayment = async () => {
    if (!pixData?.payment_id) return;
    setConfirming(true);
    try {
      const resp = await axios.post(`${API_BASE}/api/payments/simulate-confirm`, { payment_id: pixData.payment_id });
      setSuccessMsg(resp.data.message);
      await refreshUser();
      setTimeout(() => {
        onClose();
      }, 2500);
    } catch (err) {
      console.error(err);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-xl panel-glass p-8 rounded-3xl border border-white/10 shadow-2xl relative">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Zap size={22} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Adquirir Créditos de Fotos</h3>
            <p className="text-xs text-slate-400">Liberação instantânea via Pix para conversão de metadados</p>
          </div>
        </div>

        {successMsg ? (
          <div className="py-12 flex flex-col items-center justify-center text-center animate-in zoom-in">
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 shadow-[0_0_50px_rgba(16,185,129,0.2)]">
              <CheckCircle2 size={48} />
            </div>
            <h4 className="text-2xl font-bold text-white mb-2">Pagamento Confirmado!</h4>
            <p className="text-sm text-slate-300 font-medium">{successMsg}</p>
          </div>
        ) : pixData ? (
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center w-full">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest block mb-1">Valor do Pix</span>
              <span className="text-3xl font-black text-cyan-400">R$ {pixData.amount.toFixed(2)}</span>
              <span className="text-xs text-slate-400 block mt-1">+ {pixData.credits} fotos adicionadas ao seu saldo</span>
            </div>

            <div className="w-44 h-44 rounded-2xl bg-white p-3 flex flex-col items-center justify-center border-4 border-cyan-500/30 shadow-[0_0_30px_rgba(34,211,238,0.15)] relative">
              <QrCode size={130} className="text-slate-900" />
              <span className="text-[9px] font-bold text-slate-600 uppercase mt-1">Pix Copia e Cola</span>
            </div>

            <div className="w-full flex gap-2">
              <input 
                type="text" 
                readOnly 
                value={pixData.pix_code} 
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 text-xs font-mono text-slate-400 truncate"
              />
              <button 
                onClick={copyPixCode}
                className="px-4 py-3 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 font-bold text-xs hover:bg-cyan-500/30 flex items-center gap-2 shrink-0"
              >
                {copied ? <><CheckCircle2 size={14} /> Copiado!</> : <><Copy size={14} /> Copiar Pix</>}
              </button>
            </div>

            <div className="w-full mt-4 pt-4 border-t border-white/5 flex flex-col gap-2">
              <button 
                onClick={simulatePayment}
                disabled={confirming}
                className="btn-action w-full py-3.5 text-xs uppercase tracking-widest font-black flex items-center justify-center gap-2"
              >
                <Sparkles size={16} /> {confirming ? 'Confirmando Pagamento...' : 'Simular Aprovação Automática (Pix)'}
              </button>
              <p className="text-[10px] text-slate-500 text-center">No ambiente de testes local, clique no botão acima para simular a liquidação instantânea do Pix.</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-3">
              {packages.map(pkg => (
                <div 
                  key={pkg.id}
                  onClick={() => setSelectedPkg(pkg)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                    selectedPkg?.id === pkg.id 
                      ? 'bg-cyan-500/10 border-cyan-500 shadow-[0_0_20px_rgba(34,211,238,0.15)]' 
                      : 'bg-white/5 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div>
                    <span className="text-xs font-bold text-slate-300 block">{pkg.name}</span>
                    <span className="text-xl font-black text-white mt-1 block">{pkg.credits} <span className="text-[10px] font-normal text-slate-400">fotos</span></span>
                  </div>
                  <div className="mt-4 pt-2 border-t border-white/5">
                    <span className="text-sm font-bold text-cyan-400">R$ {pkg.price.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>

            {selectedPkg && (
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-xs text-slate-400 flex items-center justify-between">
                <span>Resumo: <strong>{selectedPkg.credits} fotos</strong> por <strong>R$ {selectedPkg.price.toFixed(2)}</strong></span>
                <span className="text-[10px] text-cyan-400 font-bold uppercase">Liberação Imediata</span>
              </div>
            )}

            <button 
              onClick={generatePix}
              disabled={loading || !selectedPkg}
              className="btn-action w-full py-4 mt-2 text-xs uppercase tracking-widest font-black flex items-center justify-center gap-2"
            >
              <QrCode size={18} /> {loading ? 'Gerando QR Code...' : 'Gerar QR Code Pix'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
