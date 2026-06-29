'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, Pencil, Trash2, Phone, Mail, Building } from 'lucide-react';

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  address: string | null;
  company: string | null;
  notes: string | null;
  createdAt: string;
  _count: { bills: number; quotations: number; payments: number };
}

export default function ClientsView({ businessId }: { businessId: string }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', company: '', notes: '' });

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients?businessId=${businessId}`);
      const data = await res.json();
      setClients(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const handleSubmit = async () => {
    if (!form.name || !form.phone) return;
    try {
      if (editingClient) {
        await fetch('/api/clients', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingClient.id, ...form }),
        });
      } else {
        await fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ businessId, ...form }),
        });
      }
      setDialogOpen(false);
      setEditingClient(null);
      setForm({ name: '', email: '', phone: '', address: '', company: '', notes: '' });
      fetchClients();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setForm({
      name: client.name,
      email: client.email || '',
      phone: client.phone,
      address: client.address || '',
      company: client.company || '',
      notes: client.notes || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('আপনি কি এই ক্লায়েন্ট মুছে ফেলতে চান? / Delete this client?')) return;
    try {
      await fetch(`/api/clients?id=${id}`, { method: 'DELETE' });
      fetchClients();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">ক্লায়েন্ট / Clients</h2>
          <p className="text-sm text-gray-500">{clients.length} জন ক্লায়েন্ট</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingClient(null); setForm({ name: '', email: '', phone: '', address: '', company: '', notes: '' }); } }}>
          <DialogTrigger asChild>
            <Button className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4" /> নতুন ক্লায়েন্ট
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingClient ? 'ক্লায়েন্ট এডিট / Edit Client' : 'নতুন ক্লায়েন্ট / New Client'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>নাম / Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full Name" /></div>
                <div><Label>ফোন / Phone *</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+880..." /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>ইমেইল / Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" /></div>
                <div><Label>কোম্পানি / Company</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Company Name" /></div>
              </div>
              <div><Label>ঠিকানা / Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Address" /></div>
              <div><Label>নোট / Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes..." rows={2} /></div>
              <Button onClick={handleSubmit} className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={!form.name || !form.phone}>
                {editingClient ? 'আপডেট / Update' : 'যোগ করুন / Add Client'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? <div className="text-center py-8 text-gray-400">লোড হচ্ছে...</div> : clients.length === 0 ? (
        <Card className="p-8 text-center">
          <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">কোনো ক্লায়েন্ট নেই / No clients yet</p>
          <p className="text-sm text-gray-400">উপরের বাটনে ক্লিক করে নতুন ক্লায়েন্ট যোগ করুন</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <Card key={client.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm">
                    {client.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{client.name}</p>
                    {client.company && <p className="text-xs text-gray-500 flex items-center gap-1"><Building className="h-3 w-3" />{client.company}</p>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleEdit(client)} className="p-1.5 hover:bg-gray-100 rounded"><Pencil className="h-3.5 w-3.5 text-gray-400" /></button>
                  <button onClick={() => handleDelete(client.id)} className="p-1.5 hover:bg-red-50 rounded"><Trash2 className="h-3.5 w-3.5 text-gray-400 hover:text-red-500" /></button>
                </div>
              </div>
              <div className="mt-3 space-y-1">
                <p className="text-xs text-gray-500 flex items-center gap-1"><Phone className="h-3 w-3" />{client.phone}</p>
                {client.email && <p className="text-xs text-gray-500 flex items-center gap-1"><Mail className="h-3 w-3" />{client.email}</p>}
              </div>
              <div className="mt-3 flex gap-2">
                <Badge variant="secondary" className="text-[10px]">{client._count.bills} বিল</Badge>
                <Badge variant="secondary" className="text-[10px]">{client._count.quotations} কোটেশন</Badge>
                <Badge variant="secondary" className="text-[10px]">{client._count.payments} পেমেন্ট</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
