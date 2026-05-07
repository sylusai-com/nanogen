// src/app/admin/bg-image-providers/page.js
"use client";

import { useState, useEffect } from "react";
import TopBar from "@/components/dashboard/TopBar";
import Eyebrow from "@/components/ui/Eyebrow";

export default function AdminBgImageProviders() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    type: "unsplash",
    api_key: "",
    api_endpoint: "",
    config: {},
  });

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      const res = await fetch("/api/admin/bg-image-providers");
      if (!res.ok) throw new Error("Failed to fetch providers");
      const data = await res.json();
      setProviders(data.providers || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/bg-image-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error("Failed to create provider");
      await fetchProviders();
      setShowForm(false);
      setFormData({
        name: "",
        type: "unsplash",
        api_key: "",
        api_endpoint: "",
        config: {},
      });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this provider?")) return;
    try {
      const res = await fetch(`/api/admin/bg-image-providers/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete provider");
      await fetchProviders();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggle = async (id, enabled) => {
    try {
      const res = await fetch(`/api/admin/bg-image-providers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !enabled }),
      });
      if (!res.ok) throw new Error("Failed to update provider");
      await fetchProviders();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <TopBar title="Background Image Providers" action={null} />
      <div className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8 md:py-10">
        <header className="mb-8">
          <Eyebrow tone="primary">Admin</Eyebrow>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
            Background Image <span className="text-primary-gradient">Providers</span>
          </h1>
          <p className="mt-2 text-sm text-muted">
            Configure external APIs (Unsplash, Pexels, etc.) for automatic background image fetching during banner generation.
          </p>
        </header>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="mb-6">
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 font-medium"
            >
              + Add Provider
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 border border-border rounded-lg p-6 bg-surface">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Provider Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-surface-2 text-foreground"
                  placeholder="e.g., Unsplash API"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Provider Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-surface-2 text-foreground"
                  required
                >
                  <option value="unsplash">Unsplash</option>
                  <option value="pexels">Pexels</option>
                  <option value="pixabay">Pixabay</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">API Key</label>
                <input
                  type="password"
                  value={formData.api_key}
                  onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-surface-2 text-foreground"
                  placeholder="Your API key"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">API Endpoint</label>
                <input
                  type="url"
                  value={formData.api_endpoint}
                  onChange={(e) => setFormData({ ...formData, api_endpoint: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-surface-2 text-foreground"
                  placeholder="https://api.example.com/..."
                  required
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 font-medium"
                >
                  Save Provider
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 bg-surface-2 text-foreground rounded-lg hover:bg-surface-3 font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted">Loading providers...</p>
          </div>
        ) : providers.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-lg">
            <p className="text-muted">No providers configured yet. Add one to get started!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {providers.map((provider) => (
              <div key={provider.id} className="border border-border rounded-lg p-4 bg-surface-2 flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-foreground">{provider.name}</h3>
                  <p className="text-xs text-muted mt-1">
                    Type: <span className="font-mono text-muted-strong">{provider.type}</span>
                    {provider.api_endpoint && (
                      <> • Endpoint: <span className="font-mono text-muted-strong truncate">{provider.api_endpoint}</span></>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleToggle(provider.id, provider.enabled)}
                    className={`px-3 py-1 rounded text-sm font-medium ${
                      provider.enabled
                        ? "bg-green-500/20 text-green-600"
                        : "bg-gray-500/20 text-gray-600"
                    }`}
                  >
                    {provider.enabled ? "Enabled" : "Disabled"}
                  </button>
                  <button
                    onClick={() => handleDelete(provider.id)}
                    className="px-3 py-1 rounded text-sm font-medium bg-red-500/20 text-red-600 hover:bg-red-500/30"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
