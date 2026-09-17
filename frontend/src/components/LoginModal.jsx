import React, { useState } from 'react';
import { useAuth } from '../context/useAuth';
import { Lock, Mail, Key, ShieldAlert, ArrowRight, UserPlus, LogIn } from 'lucide-react';

export default function LoginModal() {
  const { login, register, sessionAlert, setSessionAlert } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (isRegister) {
        await register(email, password);
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Ocorreu um erro. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-md panel-glass p-8 rounded-3xl border border-white/10 shadow-2xl relative">
        
        {/* Banner de Sessão Desconectada (Anti-Compartilhamento) */}
        {sessionAlert && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-center gap-3">
            <ShieldAlert size={20} className="shrink-0 text-amber-500" />
            <div>
              <p className="font-bold">Aviso de Segurança</p>
              <p className="text-[11px] opacity-90">{sessionAlert}</p>
            </div>
          </div>
        )}

        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-3 shadow-[0_0_30px_rgba(34,211,238,0.2)]">
            <Lock size={28} />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {isRegister ? 'Criar Conta Enterprise' : 'DJI Smart Converter'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {isRegister ? 'Cadastre-se e receba 50 fotos grátis' : 'Digite seus dados para acessar o conversor de fotos'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1 block">E-mail</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 text-slate-500" size={16} />
              <input 
                type="email" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@empresa.com"
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1 block">Senha</label>
            <div className="relative">
              <Key className="absolute left-3 top-3.5 text-slate-500" size={16} />
              <input 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={submitting}
            className="btn-action w-full mt-2 py-3 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2"
          >
            {submitting ? 'Carregando...' : isRegister ? (
              <><UserPlus size={16} /> Criar Minha Conta</>
            ) : (
              <><LogIn size={16} /> Entrar no Sistema</>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-white/5 flex flex-col items-center gap-3">
          <button 
            onClick={() => { setIsRegister(!isRegister); setError(''); setSessionAlert(''); }}
            className="text-xs text-cyan-400 hover:underline flex items-center gap-1 font-medium"
          >
            {isRegister ? 'Já tem uma conta? Faça Login' : 'Não tem conta? Cadastre-se e ganhe 50 fotos'} <ArrowRight size={12} />
          </button>
        </div>

      </div>
    </div>
  );
}
