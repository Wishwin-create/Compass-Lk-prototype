import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import useAdmin from "@/hooks/use-admin";
import { useToast } from "@/hooks/use-toast";

const AdminDashboard = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [loading, setLoading] = useState(false);
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [active7Days, setActive7Days] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Destination management
  type Province = { id: string; name: string };
  type Destination = { id: string; name: string; province_id: string; description?: string | null };
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [loadingDestinations, setLoadingDestinations] = useState(false);

  const [newName, setNewName] = useState("");
  const [newProvince, setNewProvince] = useState<string | null>(null);
  const [newDescription, setNewDescription] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editProvince, setEditProvince] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  // Load local pictures from src/pictures using Vite's glob - used to show local images for destinations
  const _localImages = import.meta.glob('/src/pictures/**/*.{jpg,jpeg,png,webp,gif}', { as: 'url', eager: true }) as Record<string, string>;

  const localImageEntries = Object.entries(_localImages).map(([path, url]) => {
    const parts = path.split('/');
    const filename = parts[parts.length - 1] || '';
    const key = filename.toLowerCase().replace(/[^a-z0-9]/g, '');
    return { path, url, filename, key };
  });

  const findLocalImages = (name: string) => {
    const key = (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return localImageEntries.filter((e) => e.key.includes(key)).map((e) => e.url);
  };
  const DEFAULT_BUCKET = import.meta.env.VITE_DESTINATIONS_BUCKET || "destinations";
  const [bucketName, setBucketName] = useState<string>(() => {
    try {
      return (localStorage.getItem('VITE_DESTINATIONS_BUCKET') as string) || DEFAULT_BUCKET;
    } catch (e) {
      return DEFAULT_BUCKET;
    }
  });
  const [lastUploadBucketMissing, setLastUploadBucketMissing] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    fetchStats();
    fetchDestinations();
    fetchProvinces();
  }, [isAdmin]);

  const fetchProvinces = async () => {
    try {
      const { data, error } = await supabase.from("provinces").select("id,name").order("name");
      if (error) throw error;
      setProvinces(data || []);
    } catch (err: any) {
      // ignore silently, provinces are optional for form
    }
  };

  const fetchDestinations = async () => {
    setLoadingDestinations(true);
    try {
      const { data, error } = await supabase.from("destinations").select("id,name,province_id,description").order("name");
      if (error) throw error;
      setDestinations(data || []);
    } catch (err: any) {
      toast({ title: "Error", description: "Failed to load destinations", variant: "destructive" });
    } finally {
      setLoadingDestinations(false);
    }
  };

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const { count: profilesCount, error: pErr } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true });

      if (!pErr && typeof profilesCount === "number") {
        setTotalUsers(profilesCount);
      } else {
        const { count: usersCount, error: uErr } = await supabase
          .from("users")
          .select("id", { count: "exact", head: true });
        if (!uErr && typeof usersCount === "number") {
          setTotalUsers(usersCount);
        } else {
          setTotalUsers(null);
        }
      }

      const sevenDaysIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count: activeP, error: apErr } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .gte("last_active_at", sevenDaysIso as any);

      if (!apErr && typeof activeP === "number") {
        setActive7Days(activeP);
      } else {
        const { count: activeU, error: auErr } = await supabase
          .from("users")
          .select("id", { count: "exact", head: true })
          .gte("last_sign_in_at", sevenDaysIso as any);
        if (!auErr && typeof activeU === "number") setActive7Days(activeU);
        else setActive7Days(null);
      }
    } catch (err: any) {
      setError(String(err.message || err));
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 px-4 max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-8 text-center">
              <h2 className="text-2xl font-semibold mb-4">Admin Access Required</h2>
              <p className="text-muted-foreground">You must be an administrator to view this page.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </ErrorBoundary>
  );

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 px-4 max-w-4xl mx-auto">
          {/* Debug panel: shows auth/admin state and key variables to help diagnose blank page */}
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
            <strong>Debug:</strong>
            <div>adminLoading: {String(adminLoading)}</div>
            <div>isAdmin: {String(isAdmin)}</div>
            <div>loading: {String(loading)}</div>
            <div>destinationsLoaded: {destinations.length} entries</div>
            {error && <div className="text-red-600">error: {error}</div>}
          </div>
            {/* Storage settings: allow changing bucket name used for uploads (persisted in localStorage) */}
            <div className="mb-6 p-3 bg-white border rounded">
              <div className="flex items-center justify-between">
                <div>
                  <strong>Storage Settings</strong>
                  <div className="text-sm text-muted-foreground">Bucket used for destination image uploads</div>
                </div>
                <div className="flex items-center gap-2">
                  <Input value={bucketName} onChange={(e) => setBucketName(e.target.value)} className="w-64" />
                  <Button size="sm" onClick={() => {
                    try { localStorage.setItem('VITE_DESTINATIONS_BUCKET', bucketName); toast({ title: 'Saved', description: `Bucket name set to ${bucketName}`, }); setLastUploadBucketMissing(false); } catch (e) { toast({ title: 'Error', description: 'Could not save bucket to localStorage', variant: 'destructive' }); }
                  }}>Save</Button>
                </div>
              </div>
              {lastUploadBucketMissing && (
                <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                  Uploads previously failed because the configured bucket was not found. If you created a bucket in Supabase Storage, set its name above and click Save. Otherwise create a bucket named <strong>{bucketName}</strong> in your Supabase project or enter an existing bucket name.
                </div>
              )}
            </div>
        <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-medium">Total users</h3>
              <p className="text-3xl font-bold mt-4">{loading ? '…' : (totalUsers ?? 'N/A')}</p>
              <p className="text-sm text-muted-foreground mt-2">Count from `profiles` or `users` table (if available)</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-medium">Active users (7 days)</h3>
              <p className="text-3xl font-bold mt-4">{loading ? '…' : (active7Days ?? 'N/A')}</p>
              <p className="text-sm text-muted-foreground mt-2">Based on `last_active_at` / `last_sign_in_at` if available</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Actions</h3>
              <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</Button>
                    <Button variant="ghost" size="sm" onClick={async () => {
                      // Remove duplicate destinations: group by normalized name, keep the one with most attributes
                      if (!window.confirm('Remove duplicate destinations? This will delete duplicates and cannot be undone. Proceed?')) return;
                      try {
                        // compute groups locally from currently loaded destinations
                        const groups: Record<string, any[]> = {};
                        const normalize = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
                        destinations.forEach((d: any) => {
                          const key = normalize(d.name || '');
                          if (!groups[key]) groups[key] = [];
                          groups[key].push(d);
                        });

                        const idsToDelete: string[] = [];
                        Object.values(groups).forEach((list) => {
                          if (list.length <= 1) return;
                          // compute attribute count for each entry (higher is better)
                          const scored = list.map((item: any) => {
                            let score = 0;
                            if (item.description && String(item.description).trim().length > 0) score += 2;
                            if (item.province_id) score += 1;
                            if ((item as any).image_url) score += 2;
                            if (item.location_lat || item.location_lng) score += 1;
                            // tie-breaker: prefer lower id lexical (keeps deterministic)
                            return { item, score };
                          });
                          // sort descending by score (keep first), if tie keep first by id
                          scored.sort((a: any, b: any) => {
                            if (b.score !== a.score) return b.score - a.score;
                            const aid = String(a.item.id || '');
                            const bid = String(b.item.id || '');
                            return aid.localeCompare(bid);
                          });
                          // keep the top one, delete the rest
                          const toDelete = scored.slice(1).map((s: any) => s.item.id);
                          idsToDelete.push(...toDelete);
                        });

                        if (idsToDelete.length === 0) {
                          toast({ title: 'No duplicates', description: 'No duplicate destinations found.' });
                          return;
                        }

                        // perform bulk delete
                        const res = await supabase.from('destinations').delete().in('id', idsToDelete).select();
                        console.debug('bulk delete duplicates response:', res);
                        if (res.error) {
                          toast({ title: 'Error deleting duplicates', description: String(res.error.message || JSON.stringify(res.error)), variant: 'destructive' });
                        } else {
                          toast({ title: 'Duplicates removed', description: `Deleted ${idsToDelete.length} duplicate destinations.` });
                          fetchDestinations();
                        }
                      } catch (err: any) {
                        console.error('remove duplicates error', err);
                        toast({ title: 'Error', description: String(err.message || JSON.stringify(err)), variant: 'destructive' });
                      }
                    }}>Remove Duplicates</Button>
              </div>
            </div>

            <div className="mt-4 text-sm text-muted-foreground">
              <p>Notes:</p>
              <ul className="list-disc ml-5 mt-2">
                <li>If your project stores user metadata in a different table, you'll need to expose that data via a server-side endpoint or adjust the queries.</li>
                <li>Please avoid exposing service-role keys to the client. Bulk writes or user listing should run on a server-side script or serverless function.</li>
              </ul>
            </div>

            {error && <div className="mt-4 text-red-500">{error}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-medium">Manage Destinations</h3>
            <p className="text-sm text-muted-foreground mt-2">Create or remove destinations. Avoid using service-role keys in the browser for bulk operations.</p>

            <div className="mt-4 grid gap-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>Name</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name (e.g. Sigiriya)" />
                </div>

                <div>
                  <Label>Province</Label>
                  <Select value={newProvince ?? "__none__"} onValueChange={(v) => setNewProvince(v === "__none__" ? null : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="-- select --" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">-- select --</SelectItem>
                      {provinces.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Description (optional)</Label>
                  <Textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Short description" className="h-24" />
                </div>
              </div>

              <div className="flex gap-2">
                <Button disabled={creating} onClick={async () => {
                  if (!newName.trim()) { toast({ title: "Validation", description: "Name is required", variant: "destructive" }); return; }
                  setCreating(true);
                  try {
                    // ensure user is signed in
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) {
                      toast({ title: "Authentication", description: "Please sign in to perform this action", variant: "destructive" });
                      setCreating(false);
                      return;
                    }
                    const payload: any = { name: newName.trim() };
                    if (newProvince) payload.province_id = newProvince;
                    if (newDescription) payload.description = newDescription.trim();
                    const res = await supabase.from("destinations").insert([payload]).select().single();
                    // log full response for debugging
                    console.debug("create destination response:", res);
                    if (res.error) {
                      toast({ title: "Error creating", description: String(res.error.message || JSON.stringify(res.error)), variant: "destructive" });
                    } else if (res.data) {
                      toast({ title: "Created", description: `Destination ${res.data.name} created.` });
                      setNewName(""); setNewProvince(null); setNewDescription("");
                      fetchDestinations();
                    } else {
                      toast({ title: "Error", description: "Unknown error creating destination", variant: "destructive" });
                    }
                  } catch (err: any) {
                    console.error("create error", err);
                    toast({ title: "Error", description: String(err.message || JSON.stringify(err)), variant: "destructive" });
                  } finally {
                    setCreating(false);
                  }
                }}>{creating ? 'Creating…' : 'Create Destination'}</Button>
              </div>

              <div className="mt-4">
                <h4 className="font-medium">Existing Destinations</h4>
                {loadingDestinations ? <p className="text-sm text-muted-foreground">Loading…</p> : (
                  <div className="mt-2 space-y-2">
                    {destinations.map((d) => (
                      <div key={d.id} className="p-3 border rounded">
                        <div className="flex items-start gap-4">
                          <Avatar>
                            {(d as any).image_url ? (
                              <AvatarImage src={(d as any).image_url} alt={d.name} />
                            ) : (() => {
                              const local = findLocalImages(d.name)[0];
                              return local ? <AvatarImage src={local} alt={d.name} /> : <AvatarFallback>{(d.name || "").split(" ").map(s=>s[0]).join("").slice(0,2)}</AvatarFallback>;
                            })()}
                          </Avatar>
                          <div className="flex-1">
                            {editingId === d.id ? (
                              <div className="grid gap-2">
                                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                                <Select value={editProvince ?? "__none__"} onValueChange={(v) => setEditProvince(v === "__none__" ? null : v)}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="-- province --" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">-- province --</SelectItem>
                                    {provinces.map((p) => (
                                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="h-20" />
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={async () => {
                                    // perform update
                                    try {
                                      const payload: any = { name: editName.trim(), description: editDescription || null };
                                      if (editProvince) payload.province_id = editProvince;
                                      const res = await supabase.from('destinations').update(payload).eq('id', d.id).select().single();
                                      console.debug('update destination response:', res);
                                      if (res.error) {
                                        const msg = String(res.error.message || JSON.stringify(res.error));
                                        // hint about possible RLS permission issues
                                        if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('policy') || res.error.status === 403) {
                                          toast({ title: 'Permission denied', description: 'Update blocked by RLS/policies. Ensure your user has permission or run this on a server with service-role key.', variant: 'destructive' });
                                        } else {
                                          toast({ title: 'Error', description: msg, variant: 'destructive' });
                                        }
                                        return;
                                      }
                                      toast({ title: 'Updated', description: `${res.data.name} updated.` });
                                      setEditingId(null);
                                      fetchDestinations();
                                    } catch (err: any) {
                                      console.error('update error', err);
                                      toast({ title: 'Error', description: String(err.message || JSON.stringify(err)), variant: 'destructive' });
                                    }
                                  }}>Save</Button>
                                  <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                                </div>
                                <div className="mt-2">
                                  <label className="text-sm">Upload Image</label>
                                    <input type="file" accept="image/*" onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    setUploading(true);
                                    try {
                                      const fileExt = file.name.split('.').pop();
                                      const fileName = `destinations/${d.id}-${Date.now()}.${fileExt}`;
                                      const { error: uploadErr } = await supabase.storage.from(bucketName).upload(fileName, file);
                                      if (uploadErr) {
                                        // common cause: bucket not found
                                        const msg = String(uploadErr.message || uploadErr);
                                        if (msg.toLowerCase().includes('bucket')) {
                                          setLastUploadBucketMissing(true);
                                          try { localStorage.setItem('VITE_DESTINATIONS_BUCKET', bucketName); } catch (e) {}
                                          toast({ title: 'Upload error', description: `Bucket "${bucketName}" not found. Create the storage bucket in Supabase Storage or update the bucket name in Storage Settings below.`, variant: 'destructive' });
                                        } else {
                                          toast({ title: 'Upload error', description: msg, variant: 'destructive' });
                                        }
                                        setUploading(false);
                                        return;
                                      }
                                      const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(fileName);
                                      const publicUrl = urlData.publicUrl;
                                      const res2 = await supabase.from('destinations').update({ image_url: publicUrl }).eq('id', d.id).select().single();
                                      console.debug('save image_url update response:', res2);
                                      if (res2.error) {
                                        const msg = String(res2.error.message || JSON.stringify(res2.error));
                                        if (msg.toLowerCase().includes('permission') || res2.error.status === 403) {
                                          toast({ title: 'Permission denied', description: 'Saving image_url blocked by RLS/policies. Ensure your user has permission or perform the update server-side.', variant: 'destructive' });
                                        } else {
                                          toast({ title: 'Error saving image', description: msg, variant: 'destructive' });
                                        }
                                      } else { toast({ title: 'Uploaded', description: 'Image uploaded and linked.' }); fetchDestinations(); }
                                    } catch (err: any) {
                                      toast({ title: 'Error', description: String(err.message || err), variant: 'destructive' });
                                    } finally { setUploading(false); }
                                  }} />
                                  {/* Show local images (from src/pictures) that match this destination */}
                                  <div className="mt-2 flex gap-2 flex-wrap">
                                    {findLocalImages(d.name).slice(0,6).map((url) => (
                                      <div key={url} className="w-20 h-12 border rounded overflow-hidden relative">
                                        <img src={url} className="w-full h-full object-cover" />
                                        <button className="absolute right-1 bottom-1 bg-white/80 text-xs px-1 rounded" onClick={async () => {
                                          try {
                                            const res3 = await supabase.from('destinations').update({ image_url: url }).eq('id', d.id).select().single();
                                            console.debug('assign local image update response:', res3);
                                            if (res3.error) {
                                              const msg = String(res3.error.message || JSON.stringify(res3.error));
                                              if (msg.toLowerCase().includes('permission') || res3.error.status === 403) {
                                                toast({ title: 'Permission denied', description: 'Assigning image_url blocked by RLS/policies. Ensure your user has permission or perform the update server-side.', variant: 'destructive' });
                                              } else {
                                                toast({ title: 'Error', description: msg, variant: 'destructive' });
                                              }
                                              return;
                                            }
                                            toast({ title: 'Set', description: 'Local image assigned to destination.' });
                                            fetchDestinations();
                                          } catch (err: any) { toast({ title: 'Error', description: String(err.message || err), variant: 'destructive' }); }
                                        }}>Use</button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="font-semibold">{d.name}</div>
                                <div className="text-sm text-muted-foreground">{d.description ?? ''}</div>
                              </>
                            )}
                          </div>
                          <div className="flex flex-col gap-2">
                            <Button size="sm" onClick={() => {
                              setEditingId(d.id);
                              setEditName(d.name);
                              setEditProvince(d.province_id || null);
                              setEditDescription(d.description || '');
                            }}>Edit</Button>
                            <Button variant="destructive" size="sm" onClick={async () => {
                              const ok = window.confirm(`Delete destination "${d.name}"? This cannot be undone.`);
                              if (!ok) return;
                              try {
                                const { data: { user } } = await supabase.auth.getUser();
                                if (!user) { toast({ title: 'Authentication', description: 'Please sign in to perform this action', variant: 'destructive' }); return; }

                                // perform delete and inspect full response
                                const { data, error, status } = await supabase.from('destinations').delete().eq('id', d.id).select();
                                console.debug('delete destination response:', { data, error, status });

                                if (error) {
                                  const msg = String(error.message || JSON.stringify(error));
                                  // helpful hint if RLS/policy blocks the operation
                                  if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('policy') || status === 403) {
                                    toast({ title: 'Permission denied', description: 'Delete blocked by RLS/policies. Ensure your user has permission or run this on a server with a service-role key.', variant: 'destructive' });
                                  } else {
                                    toast({ title: 'Error deleting', description: msg, variant: 'destructive' });
                                  }
                                  return;
                                }

                                // Verify whether the row was actually deleted by re-querying the DB.
                                // Some Supabase/PostgREST responses may not include deleted rows depending on RLS/policies
                                // or server settings, so this extra check ensures we accurately report success/failure.
                                await fetchDestinations();
                                try {
                                  const { data: checkData, error: checkErr } = await supabase
                                    .from('destinations')
                                    .select('id')
                                    .eq('id', d.id)
                                    .maybeSingle();

                                  if (checkErr) {
                                    console.debug('post-delete verification error:', checkErr);
                                    toast({ title: 'Deleted (verification failed)', description: 'Delete request completed; could not verify result due to a follow-up query error. Check console for details.' });
                                    return;
                                  }

                                  if (checkData) {
                                    // Row still exists -> deletion likely blocked by RLS or did not match
                                    toast({ title: 'Delete failed', description: 'The destination still exists after the delete request. This is often caused by Row Level Security (RLS) or permission rules blocking the operation. Run the delete with a service-role key or update RLS policies.', variant: 'destructive' });
                                  } else {
                                    // Row not found -> deletion succeeded
                                    setDestinations((prev) => prev.filter((x) => x.id !== d.id));
                                    toast({ title: 'Deleted', description: `${d.name} removed.` });
                                  }
                                } catch (verifyErr: any) {
                                  console.error('verification query error', verifyErr);
                                  toast({ title: 'Deleted (verification error)', description: 'Delete completed but verification query failed. See console for details.' });
                                }
                              } catch (err: any) {
                                console.error('delete destination error', err);
                                toast({ title: 'Error', description: String(err.message || JSON.stringify(err)), variant: 'destructive' });
                              }
                            }}>Delete</Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </ErrorBoundary>
  );
};

export default AdminDashboard;
