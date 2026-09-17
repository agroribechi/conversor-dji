import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, ShieldCheck, User, PlusCircle, Ban, CheckCircle, RefreshCw } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

export default function AdminPanel({ onClose }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUserId, setEditingUserId] = useState(null);
  const [newCredits, setNewCredits] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const resp = await axios.get(`${API_BASE}/api/admin/users`);
      setUsers(resp.data.users);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCredits = async (userId) => {
    if (!newCredits && newCredits !== '0') return;
    try {
      await axios.post(`${API_BASE}/api/admin/users/${userId}/credits`, { credits: newCredits });
      setEditingUserId(null);
      setNewCredits('');
      fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleStatus = async (userId, currentStatus) => {
    const nextStatus = currentStatus === 'active' ? 'blocked' : 'active';
    try {
      await axios.post(`${API_BASE}/api/admin/users/${userId}/status`, { status: nextStatus });
      fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-4xl panel-glass p-8 rounded-3xl border border-white/10 shadow-2xl relative max-h-[90vh] flex flex-col">
        
        <div className="flex justify-between items-center mb-6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Painel Administrativo</h3>
              <p className="text-xs text-slate-400">Gerenciamento de usuários, saldos e bloqueio de sessões</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchUsers} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400">
              <RefreshCw size={16} />
            </button>
            <button onClick={onClose} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Resumo de Usuários */}
        <div className="grid grid-cols-3 gap-4 mb-6 shrink-0">
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest block mb-1">Total de Contas</span>
            <span className="text-2xl font-black text-white">{users.length}</span>
          </div>
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest block mb-1">Usuários Ativos</span>
            <span className="text-2xl font-black text-emerald-400">{users.filter(u => u.status === 'active').length}</span>
          </div>
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest block mb-1">Total de Créditos Ativos</span>
            <span className="text-2xl font-black text-cyan-400">{users.reduce((acc, u) => acc + (u.credits || 0), 0)}</span>
          </div>
        </div>

        {/* Tabela de Usuários */}
        <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
          {loading ? (
            <div className="py-12 text-center text-slate-500 text-sm">Carregando usuários...</div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 uppercase text-[10px] tracking-widest">
                  <th className="py-3 px-2">Usuário</th>
                  <th className="py-3 px-2">Perfil</th>
                  <th className="py-3 px-2">Saldo de Créditos</th>
                  <th className="py-3 px-2">Status</th>
                  <th className="py-3 px-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-white/[0.02]">
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-slate-500" />
                        <span className="font-medium text-white">{u.email}</span>
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${u.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-500/20 text-slate-400'}`}>
                        {u.role.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      {editingUserId === u.id ? (
                        <div className="flex items-center gap-2">
                          <input 
                            type="number" 
                            value={newCredits}
                            onChange={(e) => setNewCredits(e.target.value)}
                            className="w-20 bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs"
                            placeholder="Qtd"
                          />
                          <button onClick={() => handleUpdateCredits(u.id)} className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">Salvar</button>
                          <button onClick={() => setEditingUserId(null)} className="px-2 py-1 rounded bg-white/5 text-slate-400 text-[10px]">Cancelar</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-cyan-400">{u.credits} fotos</span>
                          <button 
                            onClick={() => { setEditingUserId(u.id); setNewCredits(u.credits); }}
                            className="text-[10px] text-slate-500 hover:text-slate-300 underline"
                          >
                            Alterar
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-2">
                      {u.status === 'active' ? (
                        <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full text-[10px] flex items-center gap-1 w-fit">
                          <CheckCircle size={10} /> Ativo
                        </span>
                      ) : (
                        <span className="text-red-400 font-bold bg-red-500/10 px-2 py-0.5 rounded-full text-[10px] flex items-center gap-1 w-fit">
                          <Ban size={10} /> Bloqueado
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-right">
                      {u.role !== 'admin' && (
                        <button 
                          onClick={() => handleToggleStatus(u.id, u.status)}
                          className={`px-3 py-1 rounded-lg text-[10px] font-bold ${
                            u.status === 'active' 
                              ? 'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20' 
                              : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                          }`}
                        >
                          {u.status === 'active' ? 'Bloquear Acesso' : 'Desbloquear'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}
