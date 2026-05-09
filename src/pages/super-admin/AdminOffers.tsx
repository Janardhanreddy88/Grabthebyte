import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Tag, ToggleLeft, ToggleRight, Building2, Globe, UtensilsCrossed } from 'lucide-react';
import { useSuperAdmin } from '@/context/SuperAdminContext';

interface Offer {
  id: string;
  promo_code: string;
  discount_type: 'fixed' | 'percentage'; 
  discount_value: number;
  max_discount_amount: number | null;
  min_order_value: number;
  sponsored_by: 'platform' | 'canteen';
  campus_id: string | null;
  target_item_id: string | null;
  current_uses: number;
  max_global_uses: number | null;
  is_active: boolean;
  valid_until: string | null;
  // 🦅 ADDED MISSING DB COLUMNS
  valid_from: string | null;
  max_uses_per_user: number | null;
  banner_text: string | null;
  background_image_url: string | null;
}

export default function AdminOffers() {
  const { toast } = useToast();
  const { campuses } = useSuperAdmin();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  const [menuItems, setMenuItems] = useState<{id: string, name: string}[]>([]);

  const [formData, setFormData] = useState({
    promo_code: '',
    discount_type: 'fixed' as 'fixed' | 'percentage',
    discount_value: '',
    max_discount_amount: '',
    min_order_value: '0',
    sponsored_by: 'platform' as 'platform' | 'canteen',
    campus_id: 'all',
    target_item_id: 'all', 
    max_global_uses: '',
    valid_until: '',
    // 🦅 ADDED TO STATE
    valid_from: '',
    max_uses_per_user: '1', // Defaulting to 1 per user to prevent abuse!
    banner_text: '',
    background_image_url: ''
  });

  useEffect(() => {
    fetchOffers();
  }, []);

  useEffect(() => {
    setFormData(prev => ({ ...prev, target_item_id: 'all' })); 

    if (formData.campus_id !== 'all') {
      supabase.from('menu_items').select('id, name').eq('campus_id', formData.campus_id).then(({data}) => {
        if (data) setMenuItems(data);
      });
    } else {
      setMenuItems([]);
    }
  }, [formData.campus_id]);

  const fetchOffers = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('offers')
      .select('*')
      .order('created_at', { ascending: false })
      .returns<Offer[]>(); 

    if (error) {
      toast({ title: 'Error fetching offers', description: error.message, variant: 'destructive' });
    } else if (data) {
      setOffers(data); 
    }
    setLoading(false);
  };

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const isFixed = formData.discount_type === 'fixed';
      const cleanMaxDiscount = (isFixed || !formData.max_discount_amount) 
        ? null 
        : Math.abs(Number(formData.max_discount_amount));

      // 🦅 FULL DB PAYLOAD MAPPING
      const newOffer = {
        promo_code: formData.promo_code.toUpperCase().trim(),
        discount_type: formData.discount_type,
        discount_value: Math.abs(Number(formData.discount_value)),
        max_discount_amount: cleanMaxDiscount,
        min_order_value: Math.abs(Number(formData.min_order_value)),
        sponsored_by: formData.sponsored_by,
        campus_id: formData.campus_id === 'all' ? null : formData.campus_id,
        target_item_id: formData.target_item_id === 'all' ? null : formData.target_item_id,
        max_global_uses: formData.max_global_uses ? Math.abs(Number(formData.max_global_uses)) : null,
        
        // Dates & New Fields
        valid_from: formData.valid_from ? new Date(formData.valid_from).toISOString() : new Date().toISOString(), // Default to right now if empty
        valid_until: formData.valid_until ? new Date(formData.valid_until).toISOString() : null,
        max_uses_per_user: formData.max_uses_per_user ? Math.abs(Number(formData.max_uses_per_user)) : null,
        banner_text: formData.banner_text.trim() || null,
        background_image_url: formData.background_image_url.trim() || null,

        is_active: true,
        current_uses: 0
      };

      const { error } = await supabase.from('offers').insert([newOffer]);

      if (error) throw error;

      toast({ title: 'Success!', description: 'Promo code created successfully.' });
      setShowCreateForm(false);
      setFormData({ 
        promo_code: '', discount_type: 'fixed', discount_value: '', max_discount_amount: '', 
        min_order_value: '0', sponsored_by: 'platform', campus_id: 'all', target_item_id: 'all', 
        max_global_uses: '', valid_until: '', valid_from: '', max_uses_per_user: '1', banner_text: '', background_image_url: '' 
      });
      fetchOffers();
    } catch (error: any) {
      toast({ title: 'Creation Failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    const { data, error } = await supabase
      .from('offers')
      .update({ is_active: !currentStatus })
      .eq('id', id)
      .select();

    if (error) {
      toast({ title: 'Update Failed', description: error.message, variant: 'destructive' });
    } else if (!data || data.length === 0) {
      toast({ title: 'Permission Denied', description: 'RLS blocked this update. Check Supabase policies.', variant: 'destructive' });
    } else {
      toast({ title: 'Status Updated', description: `Offer is now ${!currentStatus ? 'Active' : 'Paused'}.` });
      setOffers(offers.map(o => o.id === id ? { ...o, is_active: !currentStatus } : o));
    }
  };

  const getCampusName = (campusId: string | null) => {
    if (!campusId) return 'Global';
    const campus = campuses.find(c => c.id === campusId);
    return campus ? `${campus.name}` : 'Unknown';
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Tag className="text-emerald-600" /> Offers & Marketing
          </h1>
          <p className="text-slate-500 text-sm mt-1">Manage platform promo codes, sponsorships, and discounts.</p>
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)} className="bg-slate-900 text-white rounded-xl">
          {showCreateForm ? 'Cancel' : <><Plus className="w-4 h-4 mr-2" /> Create Offer</>}
        </Button>
      </div>

      {showCreateForm && (
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200 animate-in fade-in slide-in-from-top-4">
          <h2 className="text-lg font-bold mb-4">Create New Promo Code</h2>
          <form onSubmit={handleCreateOffer} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* ROW 1 */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Promo Code</label>
              <Input required value={formData.promo_code} onChange={e => setFormData({...formData, promo_code: e.target.value})} placeholder="e.g. WELCOME50" className="uppercase font-bold" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Banner Text (App UI)</label>
              <Input value={formData.banner_text} onChange={e => setFormData({...formData, banner_text: e.target.value})} placeholder="e.g. Flat ₹50 Off on Snacks!" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Discount Type</label>
              <select className="w-full h-10 rounded-md border border-slate-200 px-3 text-sm" value={formData.discount_type} onChange={e => setFormData({...formData, discount_type: e.target.value as any})}>
                <option value="fixed">Flat Amount (₹)</option>
                <option value="percentage">Percentage (%)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Discount Value</label>
              <Input required type="number" min="0" value={formData.discount_value} onChange={e => setFormData({...formData, discount_value: e.target.value})} placeholder={formData.discount_type === 'fixed' ? '₹ Amount' : '% Amount'} />
            </div>

            {/* ROW 2 */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Min Order Value (₹)</label>
              <Input required type="number" min="0" value={formData.min_order_value} onChange={e => setFormData({...formData, min_order_value: e.target.value})} />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Max Discount Cap (₹)</label>
              <Input type="number" min="0" disabled={formData.discount_type === 'fixed'} value={formData.max_discount_amount} onChange={e => setFormData({...formData, max_discount_amount: e.target.value})} placeholder="Leave blank for no cap" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Target Campus</label>
              <select className="w-full h-10 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 bg-slate-50" value={formData.campus_id} onChange={e => setFormData({...formData, campus_id: e.target.value})}>
                <option value="all">🌍 Global (All Campuses)</option>
                {campuses.map(c => (
                  <option key={c.id} value={c.id}>🏢 {c.name} ({c.code})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center justify-between">
                Target Specific Item <UtensilsCrossed size={12} className="text-slate-400" />
              </label>
              <select 
                disabled={formData.campus_id === 'all'} 
                className="w-full h-10 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 bg-slate-50 disabled:opacity-50" 
                value={formData.target_item_id} 
                onChange={e => setFormData({...formData, target_item_id: e.target.value})}
              >
                <option value="all">🛒 Entire Cart</option>
                {menuItems.map(item => (
                  <option key={item.id} value={item.id}>🍗 {item.name}</option>
                ))}
              </select>
            </div>

            {/* ROW 3 */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">Sponsored By</label>
              <select className="w-full h-10 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 bg-slate-50" value={formData.sponsored_by} onChange={e => setFormData({...formData, sponsored_by: e.target.value as any})}>
                <option value="platform">GrabTheByte (Platform)</option>
                <option value="canteen">Canteen Owner</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Max Uses Per Student</label>
              <Input type="number" min="1" value={formData.max_uses_per_user} onChange={e => setFormData({...formData, max_uses_per_user: e.target.value})} placeholder="e.g. 1" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Total Global Uses</label>
              <Input type="number" min="1" value={formData.max_global_uses} onChange={e => setFormData({...formData, max_global_uses: e.target.value})} placeholder="e.g. 100 max" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Background Image URL</label>
              <Input type="url" value={formData.background_image_url} onChange={e => setFormData({...formData, background_image_url: e.target.value})} placeholder="https://..." />
            </div>

            {/* ROW 4 */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Start Date (Valid From)</label>
              <Input type="datetime-local" value={formData.valid_from} onChange={e => setFormData({...formData, valid_from: e.target.value})} />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Expiry Date (Valid Until)</label>
              <Input type="datetime-local" value={formData.valid_until} onChange={e => setFormData({...formData, valid_until: e.target.value})} />
            </div>

            <div className="col-span-full md:col-span-2 mt-auto">
              <Button type="submit" disabled={isSubmitting} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 rounded-md">
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Launch Offer'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Offers Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>
        ) : offers.length === 0 ? (
          <div className="p-12 text-center text-slate-500">No promo codes found. Create your first one above!</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                <tr>
                  <th className="px-6 py-4">Promo Code</th>
                  <th className="px-6 py-4">Targeting</th>
                  <th className="px-6 py-4">Offer Details</th>
                  <th className="px-6 py-4">Sponsor</th>
                  <th className="px-6 py-4">Performance</th>
                  <th className="px-6 py-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {offers.map((offer) => (
                  <tr key={offer.id} className={offer.is_active ? 'bg-white' : 'bg-slate-50 opacity-75'}>
                    <td className="px-6 py-4">
                      <span className="font-black text-lg tracking-tight text-slate-900">{offer.promo_code}</span>
                      <div className="text-xs text-slate-500 mt-1">Min. ₹{offer.min_order_value}</div>
                      {offer.banner_text && <div className="text-[10px] text-blue-600 font-medium mt-1">"{offer.banner_text}"</div>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {offer.campus_id ? (
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                            <Building2 size={12} className="text-slate-400" /> {getCampusName(offer.campus_id)}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 w-max px-2 py-0.5 rounded-md">
                            <Globe size={12} /> Global
                          </div>
                        )}
                        {offer.target_item_id ? (
                           <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600 bg-blue-50 w-max px-2 py-0.5 rounded-md">
                             <UtensilsCrossed size={10} /> Specific Item Only
                           </div>
                        ) : (
                           <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                             🛒 Entire Cart
                           </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-emerald-600">
                        {offer.discount_type === 'fixed' ? `₹${offer.discount_value} OFF` : `${offer.discount_value}% OFF`}
                      </div>
                      {offer.max_discount_amount && <div className="text-xs text-slate-500 mt-1">Up to ₹{offer.max_discount_amount}</div>}
                    </td>
                    <td className="px-6 py-4">
                      {offer.sponsored_by === 'platform' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 uppercase tracking-wider">
                           GrabTheByte
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 uppercase tracking-wider">
                           Canteen
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-700 text-xs flex flex-col gap-0.5">
                        <span>{offer.current_uses} {offer.max_global_uses ? `/ ${offer.max_global_uses}` : ''} total claims</span>
                        <span className="text-[10px] text-slate-400">Limit: {offer.max_uses_per_user || 'Unlimited'} per user</span>
                      </div>
                      <div className="w-24 h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full" 
                          style={{ width: offer.max_global_uses ? `${(offer.current_uses / offer.max_global_uses) * 100}%` : '0%' }}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button onClick={() => toggleStatus(offer.id, offer.is_active)} className="hover:scale-110 transition-transform">
                        {offer.is_active ? <ToggleRight className="w-8 h-8 text-emerald-500" /> : <ToggleLeft className="w-8 h-8 text-slate-300" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}