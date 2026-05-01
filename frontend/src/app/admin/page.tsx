'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const AdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0 });

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:8000';
        const res = await fetch(`${gatewayUrl}/users/users/admin/users`);
        const data = await res.json();
        setUsers(data.users || []);
        setStats({ total: data.total || 0 });
      } catch (err) {
        console.error('Failed to fetch users:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8 font-[Outfit,sans-serif]">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto"
      >
        <header className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              Admin Dashboard
            </h1>
            <p className="text-gray-400 mt-2">Manage RentPi system and users</p>
          </div>
          <div className="flex gap-4">
            <div className="bg-[#1a1a1a] p-4 rounded-2xl border border-white/5 backdrop-blur-xl">
              <span className="text-xs text-gray-500 block uppercase tracking-wider mb-1">Total Users</span>
              <span className="text-2xl font-bold text-blue-400">{stats.total}</span>
            </div>
          </div>
        </header>

        <section className="grid gap-6">
          <div className="bg-[#111] rounded-3xl border border-white/5 overflow-hidden">
            <div className="p-6 border-b border-white/5 flex justify-between items-center">
              <h2 className="text-xl font-semibold">User Management</h2>
              <button className="px-4 py-2 bg-blue-600/10 text-blue-400 rounded-full text-sm font-medium border border-blue-600/20 hover:bg-blue-600/20 transition-all">
                Export Data
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-gray-500 text-sm uppercase tracking-wider">
                    <th className="px-6 py-4 font-medium">ID</th>
                    <th className="px-6 py-4 font-medium">Name</th>
                    <th className="px-6 py-4 font-medium">Email</th>
                    <th className="px-6 py-4 font-medium">Joined</th>
                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <AnimatePresence>
                    {loading ? (
                      [...Array(5)].map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          <td colSpan={5} className="px-6 py-4">
                            <div className="h-12 bg-white/5 rounded-xl w-full"></div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      users.map((user, idx) => (
                        <motion.tr 
                          key={user.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="px-6 py-4 text-gray-400 font-mono text-sm">#{user.id}</td>
                          <td className="px-6 py-4">
                            <div className="font-medium text-gray-200">{user.name}</div>
                          </td>
                          <td className="px-6 py-4 text-gray-400">{user.email}</td>
                          <td className="px-6 py-4 text-gray-500 text-sm">
                            {new Date(user.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button className="text-blue-400 hover:text-blue-300 mr-4 text-sm font-medium">Edit</button>
                            <button className="text-red-400 hover:text-red-300 text-sm font-medium">Delete</button>
                          </td>
                        </motion.tr>
                      ))
                    )}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </motion.div>
    </div>
  );
};

export default AdminDashboard;
