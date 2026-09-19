import React, { useState, useEffect } from 'react';
import { 
  UploadCloud, 
  CheckCircle, 
  Download, 
  Trash2, 
  Zap, 
  ShieldCheck, 
  RefreshCw,
  ImageIcon,
  LogOut,
  User,
  PlusCircle,
  Coins,
  Cpu,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

import { useAuth } from './context/useAuth';
import LoginModal from './components/LoginModal';
import BuyCreditsModal from './components/BuyCreditsModal';
import AdminPanel from './components/AdminPanel';
import { API_BASE } from './config/api';

const ProfileItem = ({ name, active, onClick }) => (
  <div 
    onClick={onClick}
    className={`nav-item transition-all duration-200 cursor-pointer ${active ? 'active bg-white/10 text-white shadow-[0_4px_12px_rgba(34,211,238,0.1)]' : 'hover:bg-white/5 text-slate-400'}`}
  >
    <div className={`w-2 h-2 rounded-full ${active ? 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]' : 'bg-slate-600'}`} />
    <span className="font-medium text-sm">{name}</span>
  </div>
);

const FilePreview = ({ file, onRemove }) => {
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  return (
    <div className="group relative w-32 h-32 rounded-2xl bg-white/5 border border-white/10 overflow-hidden flex flex-col items-center justify-center gap-2 transition-all hover:border-cyan-500/50">
      {preview ? (
        <img src={preview} alt="preview" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
      ) : (
        <RefreshCw size={24} className="text-slate-500" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
      <span className="absolute bottom-2 left-2 right-2 text-[8px] font-bold text-white truncate text-center">{file.name}</span>
      <button 
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="absolute top-2 right-2 p-1 rounded-lg bg-red-500/20 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
};

export default function App() {
  const { user, loading, logout, refreshUser } = useAuth();
  
  const [files, setFiles] = useState([]);
  const [profile, setProfile] = useState('mini3');
  const [status, setStatus] = useState('idle');
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [backendOnline, setBackendOnline] = useState('checking');

  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);

  // Health Check Inicial do Backend
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const endpoint = API_BASE ? `${API_BASE}/api/health` : '/api/health';
        await axios.get(endpoint);
        setBackendOnline('online');
      } catch (err) {
        setBackendOnline('offline');
      }
    };
    checkBackend();
    const timer = setInterval(checkBackend, 5000);
    return () => clearInterval(timer);
  }, []);

  const onFileChange = (e) => {
    const selected = Array.from(e.target.files);
    if (selected.length > 0) {
      setFiles(prev => [...prev, ...selected]);
      setStatus('idle');
      setDownloadUrl(null);
      setErrorMsg('');
    }
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const processFiles = async () => {
    if (files.length === 0) return;

    if (user?.role !== 'admin' && (user?.credits || 0) < files.length) {
      setErrorMsg(`Saldo insuficiente. Você tem ${user?.credits || 0} créditos e tentou enviar ${files.length} fotos.`);
      setStatus('error');
      setShowBuyModal(true);
      return;
    }

    setStatus('uploading');
    setErrorMsg('');

    const formData = new FormData();
    files.forEach(f => formData.append('files', f));

    try {
      const resp = await axios.post(`${API_BASE}/upload?profile=${profile}`, formData);
      setDownloadUrl(`${API_BASE}${resp.data.download_url}`);
      setStatus('success');
      await refreshUser();
    } catch (err) {
      const msg = err.response?.data?.error || 'Erro de conexão com o servidor 8000.';
      console.error('Erro de conversão:', err);
      setErrorMsg(msg);
      setStatus('error');
      if (err.response?.data?.creditsShortage) {
        setShowBuyModal(true);
      }
    }
  };

  const reset = () => {
    setFiles([]);
    setDownloadUrl(null);
    setStatus('idle');
    setErrorMsg('');
  };

  if (loading) {
    return (
      <div className="w-full min-h-screen flex flex-col items-center justify-center bg-[#0a0f1d] text-white">
        <RefreshCw className="animate-spin text-cyan-400 mb-4" size={40} />
        <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">Inicializando Sistema DJI...</p>
      </div>
    );
  }

  return (
    <div className="app-container w-full max-w-[1280px] mx-auto min-h-screen py-8 px-6">
      
      {/* Modal de Login / Autenticação (quando não autenticado) */}
      {!user && <LoginModal />}

      {/* Modal de Compra de Créditos Pix */}
      {showBuyModal && <BuyCreditsModal onClose={() => setShowBuyModal(false)} />}

      {/* Modal de Painel Administrativo */}
      {showAdminModal && <AdminPanel onClose={() => setShowAdminModal(false)} />}

      <div className="flex gap-6 h-[85vh]">
        
        {/* Sidebar */}
        <aside className="w-[300px] panel-glass p-8 flex flex-col gap-8 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <RefreshCw className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-none text-white">DJI Smart</h1>
              <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-cyan-400">Converter Pro</span>
            </div>
          </div>

          {/* Card do Usuário Logado & Créditos */}
          {user && (
            <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 overflow-hidden">
                  <User size={14} className="text-cyan-400 shrink-0" />
                  <span className="text-xs font-bold text-white truncate">{user.email}</span>
                </div>
                <button onClick={() => logout()} title="Sair da Conta" className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-red-400">
                  <LogOut size={14} />
                </button>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-cyan-500/20">
                <div className="flex items-center gap-1.5 text-cyan-400">
                  <Coins size={16} />
                  <span className="text-sm font-black">{user.credits} <span className="text-[10px] font-medium text-slate-400">créditos</span></span>
                </div>
                <button 
                  onClick={() => setShowBuyModal(true)}
                  className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-bold text-[10px] flex items-center gap-1 uppercase tracking-wider"
                >
                  <PlusCircle size={12} /> Comprar
                </button>
              </div>

              {user.role === 'admin' && (
                <button 
                  onClick={() => setShowAdminModal(true)}
                  className="mt-1 py-1.5 w-full rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300 font-bold text-[10px] uppercase tracking-widest hover:bg-purple-500/30 flex items-center justify-center gap-1.5"
                >
                  <ShieldCheck size={14} /> Painel Admin
                </button>
              )}
            </div>
          )}

          <nav className="flex flex-col gap-2">
            <label className="text-[10px] uppercase font-bold tracking-widest text-slate-500 px-4 mb-1">Perfis de Drone</label>
            <ProfileItem name="DJI Mini 3/4 Pro" active={profile === 'mini3'} onClick={() => setProfile('mini3')} />
            <ProfileItem name="DJI Neo" active={profile === 'neo'} onClick={() => setProfile('neo')} />
            <ProfileItem name="Mavic Pro Series" active={profile === 'mavicpro'} onClick={() => setProfile('mavicpro')} />
            <ProfileItem name="Perfil Genérico" active={profile === 'default'} onClick={() => setProfile('default')} />
          </nav>

          <div className="mt-auto">
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 mb-2 uppercase">
                <ShieldCheck size={14} className={backendOnline === 'online' ? "text-emerald-500" : "text-amber-500"} /> 
                Status do Motor
              </div>
              <div className="flex items-center justify-between text-[10px] uppercase">
                <span className="text-slate-500">ExifTool Engine</span>
                {backendOnline === 'online' ? (
                  <span className="text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">Online</span>
                ) : backendOnline === 'checking' ? (
                  <span className="text-amber-500 font-bold animate-pulse">Checando...</span>
                ) : (
                  <span className="text-red-500 font-bold bg-red-500/10 px-2 py-0.5 rounded-full">Offline</span>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* Main Workstation */}
        <main className="flex-1 flex flex-col gap-6 overflow-hidden">
          
          <div className="panel-glass p-8 flex justify-between items-center shrink-0">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-white line-clamp-1">DJI Smart Farm Station</h2>
              <p className="text-slate-400 text-sm mt-1">Motor ExifTool nativo garantindo 100% de compatibilidade com DJI Smart Farm Web.</p>
            </div>
            <div className="flex gap-3">
              <div className="px-4 py-2 rounded-xl bg-white/[0.05] border border-white/[0.05] flex items-center gap-2 text-[10px] font-bold text-slate-300">
                <Cpu size={14} /> EXIFTOOL ENGINE
              </div>
              <button 
                onClick={() => setShowBuyModal(true)}
                className="px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-bold text-xs flex items-center gap-2 hover:bg-cyan-500/20"
              >
                <Coins size={14} /> {user?.credits || 0} Fotos Disponíveis
              </button>
            </div>
          </div>

          <div className="panel-glass flex-1 p-10 flex flex-col relative overflow-hidden">
            <AnimatePresence mode="wait">
              {files.length === 0 ? (
                <motion.div 
                  key="empty"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  className="w-full h-full flex flex-col items-center justify-center dropzone relative cursor-pointer group"
                >
                  <input type="file" multiple onChange={onFileChange} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                  <div className="w-24 h-24 rounded-3xl bg-cyan-500/10 flex items-center justify-center mb-6 group-hover:bg-cyan-500/20 transition-all shadow-[0_0_50px_rgba(34,211,238,0.1)]">
                    <UploadCloud className="text-cyan-400" size={48} />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Arraste fotos do drone</h3>
                  <p className="text-slate-400 text-sm text-center max-w-[280px]">As miniaturas aparecerão automaticamente após o carregamento inicial.</p>
                </motion.div>
              ) : (
                <motion.div 
                  key="work"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="w-full h-full flex flex-col"
                >
                  {status === 'idle' && (
                    <>
                      <div className="flex justify-between items-center mb-6">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Fila de Processamento</span>
                          <span className="text-lg font-bold text-white italic">{files.length} arquivos selecionados</span>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={reset} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold hover:bg-white/10 text-slate-300">LIMPAR</button>
                          <label className="px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-[10px] font-bold hover:bg-cyan-500/20 text-cyan-400 cursor-pointer">Adicionar Fotos
                            <input type="file" multiple onChange={onFileChange} className="hidden" />
                          </label>
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-4 gap-4 mb-8 content-start scrollbar-thin scrollbar-thumb-white/10">
                        {files.map((f, i) => (
                          <FilePreview key={i} file={f} onRemove={() => removeFile(i)} />
                        ))}
                      </div>

                      {user?.role !== 'admin' && (user?.credits || 0) < files.length && (
                        <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-center justify-between font-medium">
                          <span>Atenção: Seu lote possui {files.length} fotos, mas você tem {user?.credits || 0} créditos.</span>
                          <button onClick={() => setShowBuyModal(true)} className="px-3 py-1 bg-amber-500/20 rounded-lg text-amber-300 font-bold uppercase text-[10px]">
                            Recarregar Créditos
                          </button>
                        </div>
                      )}

                      <div className="mt-auto flex justify-center p-4 border-t border-white/5">
                        {backendOnline === 'online' ? (
                          <button onClick={processFiles} className="btn-action w-full max-w-sm text-sm uppercase tracking-widest font-black">
                            INICIAR CONVERSÃO EXIFTOOL ({files.length} FOTOS)
                          </button>
                        ) : (
                          <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-2xl w-full text-center text-xs font-bold uppercase tracking-widest">
                            SERVIDOR EXIFTOOL OFFLINE
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {status === 'uploading' && (
                    <div className="h-full flex flex-col items-center justify-center gap-6">
                      <div className="relative">
                        <RefreshCw className="animate-spin text-cyan-400" size={64} />
                        <div className="absolute inset-0 blur-2xl bg-cyan-500/20 animate-pulse rounded-full" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-black tracking-[0.4em] uppercase animate-pulse mb-1">Injetando Metadados Nativo ExifTool Engine</p>
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Gravando tags RTK & XMP-drone-dji de fotogrametria...</p>
                      </div>
                    </div>
                  )}

                  {status === 'success' && (
                    <div className="h-full flex flex-col items-center justify-center animate-in zoom-in duration-300">
                      <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(16,185,129,0.1)]">
                        <CheckCircle className="text-emerald-500" size={40} />
                      </div>
                      <h4 className="text-2xl font-bold text-white mb-2">Conversão Concluída!</h4>
                      <p className="text-slate-400 text-sm mb-10 max-w-[320px] text-center font-medium">Fotos convertidas e otimizadas prontas no arquivo ZIP.</p>
                      <div className="flex gap-4 w-full max-w-sm">
                        <button onClick={reset} className="flex-1 px-6 py-4 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-bold hover:bg-white/10 uppercase tracking-widest">NOVO LOTE</button>
                        <a href={downloadUrl} download="dji_converted.zip" className="flex-[2] btn-action no-underline flex items-center justify-center gap-3">
                          <Download size={20} /> BAIXAR ZIP
                        </a>
                      </div>
                    </div>
                  )}

                  {status === 'error' && (
                    <div className="h-full flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
                        <Zap className="text-red-500 animate-pulse" size={32} />
                      </div>
                      <h4 className="text-xl font-bold text-red-500 tracking-tight uppercase">Erro de Processamento</h4>
                      <p className="text-slate-400 text-xs mt-2 text-center max-w-[320px] font-medium leading-relaxed">{errorMsg}</p>
                      <div className="mt-8 flex gap-4">
                        <button onClick={reset} className="px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-bold text-slate-300 hover:bg-white/10 uppercase tracking-widest">LIMPAR E TENTAR DE NOVO</button>
                        <button onClick={() => setShowBuyModal(true)} className="btn-action px-8 py-4 text-[10px] font-black uppercase tracking-widest">COMPRAR CRÉDITOS</button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>
      
      <footer className="mt-8 flex justify-between items-center text-[9px] text-slate-600 font-bold tracking-[0.4em] uppercase">
        <span>DJI Converter Enterprise &copy; 2026</span>
        <div className="flex gap-8">
          <span className="flex items-center gap-2"><Settings size={10} /> Native ExifTool Engine</span>
          <span className="flex items-center gap-2 text-cyan-900/50"><ImageIcon size={10} /> 100% DJI Terra & Smart Farm Compatible</span>
        </div>
      </footer>
    </div>
  );
}
