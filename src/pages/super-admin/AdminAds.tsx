import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, ToggleLeft, ToggleRight, Building2, Globe, ImageIcon, CheckCircle2, Megaphone, UploadCloud, ExternalLink } from 'lucide-react';
import { useSuperAdmin } from '@/context/SuperAdminContext';

interface AdBanner {
  id: string;
  title: string;
  image_url: string;
  target_campus_id: string | null;
  redirect_url: string | null;
  is_active: boolean;
  created_at: string;
}

export default function AdminAds() {
  const { toast } = useToast();
  const { campuses } = useSuperAdmin();
  
  const [ads, setAds] = useState<AdBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    image_url: '',
    target_campus_id: 'all',
    redirect_url: ''
  });

  useEffect(() => {
    fetchAds();
  }, []);

  const fetchAds = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('ad_banners')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error fetching ads', description: error.message, variant: 'destructive' });
    } else if (data) {
      setAds(data as AdBanner[]);
    }
    setLoading(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `ad_${Math.random().toString(36).substring(2, 15)}.${fileExt}`;

      // Reusing the offer_banners bucket to keep storage clean
      const { error: uploadError } = await supabase.storage
        .from('offer_banners')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('offer_banners')
        .getPublicUrl(fileName);

      setFormData(prev => ({ ...prev, image_url: publicUrlData.publicUrl }));
      toast({ title: 'Image Uploaded!', description: 'Ad banner image is ready.' });
    } catch (error: any) {
      toast({ title: 'Upload Failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateAd = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const newAd = {
        title: formData.title.trim(),
        image_url: formData.image_url,
        target_campus_id: formData.target_campus_id === 'all' ? null : formData.target_campus_id,
        redirect_url: formData.redirect_url.trim() || null,
        is_active: true
      };

      const { error } = await supabase.from('ad_banners').insert([newAd]);
      if (error) throw error;

      toast({ title: 'Success!', description: 'Ad banner launched successfully.' });
      setShowCreateForm(false);
      setFormData({ title: '', image_url: '', target_campus_id: 'all', redirect_url: '' });
      fetchAds();
    } catch (error: any) {
      toast({ title: 'Creation Failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase.from('ad_banners').update({ is_active: !currentStatus }).eq('id', id);
    if (error) {
      toast({ title: 'Update Failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Status Updated', description: `Ad is now ${!currentStatus ? 'Live' : 'Paused'}.` });
      fetchAds();
    }
  };

  const getCampusName = (campusId: string | null) => {
    if (!campusId) return 'Global';
    const campus = campuses.find(c => c.id === campusId);
    return campus ? `${campus.name}` : 'Unknown';
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-black text-blue-900 flex items-center gap-2">
            <Megaphone className="text-blue-600" /> Ad & Announcement Manager
          </h1>
          <p className="text-slate-500 text-sm mt-1">Upload visual billboards, event announcements, and sponsored links.</p>
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
          {showCreateForm ? 'Cancel' : <><Plus className="w-4 h-4 mr-2" /> Upload Banner</>}
        </Button>
      </div>

      {/* Creation Form */}
      {showCreateForm && (
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200 animate-in fade-in slide-in-from-top-4">
          <h2 className="text-lg font-bold mb-4 text-blue-900">Launch New Billboard</h2>
          
          <form onSubmit={handleCreateAd} className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Internal Ad Title (For Admin Tracking)</label>
              <Input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g. College Fest 2026 Announcement" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Target Campus</label>
              <select className="w-full h-10 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 bg-slate-50" value={formData.target_campus_id} onChange={e => setFormData({...formData, target_campus_id: e.target.value})}>
                <option value="all">🌍 Global (All Campuses)</option>
                {campuses.map(c => (
                  <option key={c.id} value={c.id}>🏢 {c.name} ({c.code})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1 col-span-full">
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">Redirect Link (Optional)</label>
              <Input type="url" value={formData.redirect_url} onChange={e => setFormData({...formData, redirect_url: e.target.value})} placeholder="https://instagram.com/... (Leave blank for no click action)" />
            </div>

            <div className="space-y-1 col-span-full border-t pt-4 mt-2">
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1 mb-2">
                <UploadCloud size={14} className="text-blue-500" /> Upload Ad Image (16:9 Aspect Ratio)
              </label>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <Input required={!formData.image_url} type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploading} className="cursor-pointer file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 text-sm w-full md:w-auto h-auto"/>
                {isUploading && <Loader2 className="w-6 h-6 animate-spin text-blue-600" />}
              </div>
              {formData.image_url && (
                <div className="mt-4 relative h-32 md:h-48 w-full max-w-lg rounded-xl overflow-hidden border border-slate-200 shadow-md">
                  <img src={formData.image_url} alt="Ad Preview" className="w-full h-full object-cover bg-slate-50" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                  <div className="absolute bottom-2 right-3 text-xs font-bold text-white tracking-wider flex items-center gap-1">
                    <CheckCircle2 size={14} className="text-emerald-400" /> READY
                  </div>
                </div>
              )}
            </div>

            <div className="col-span-full mt-4 flex justify-end">
              <Button type="submit" disabled={isSubmitting || isUploading || !formData.image_url} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 px-8 rounded-lg shadow-md">
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <ImageIcon className="w-4 h-4 mr-2" />} Launch Billboard
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Ads Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>
        ) : ads.length === 0 ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center">
            <ImageIcon className="w-12 h-12 text-slate-200 mb-3" />
            <p>No active billboards. Upload your first announcement above!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                <tr><th className="px-6 py-4">Creative</th><th className="px-6 py-4">Title</th><th className="px-6 py-4">Targeting</th><th className="px-6 py-4">Click Action</th><th className="px-6 py-4 text-center">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ads.map((ad) => (
                  <tr key={ad.id} className={ad.is_active ? 'bg-white' : 'bg-slate-50 opacity-75'}>
                    <td className="px-6 py-4">
                      <div className="h-16 w-32 rounded-md overflow-hidden border border-slate-200 bg-slate-50">
                         <img src={ad.image_url} alt="Ad" className="w-full h-full object-cover" />
                      </div>
                    </td>
                    <td className="px-6 py-4 font-black text-slate-800 text-base">{ad.title}</td>
                    <td className="px-6 py-4">
                      {ad.target_campus_id ? (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700"><Building2 size={12} className="text-slate-400" /> {getCampusName(ad.target_campus_id)}</div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 w-max px-2 py-0.5 rounded-md"><Globe size={12} /> Global</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {ad.redirect_url ? (
                        <a href={ad.redirect_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline">
                          <ExternalLink size={12} /> URL Attached
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Visual Only (No link)</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button onClick={() => toggleStatus(ad.id, ad.is_active)} className="hover:scale-110 transition-transform">
                        {ad.is_active ? <ToggleRight className="w-8 h-8 text-blue-500" /> : <ToggleLeft className="w-8 h-8 text-slate-300" />}
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