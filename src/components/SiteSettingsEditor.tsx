import React, { useState, useEffect } from 'react';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { Save, AlertCircle, Check, Upload, Trash2 } from 'lucide-react';
import { uploadSiteLogo, removeSiteLogo } from '../services/api';

export const SiteSettingsEditor: React.FC = () => {
  const { config, updateConfig } = useSiteSettings();
  const [formData, setFormData] = useState(config);
  const [activeSection, setActiveSection] = useState<'hero' | 'header' | 'footer' | 'meta'>(() => {
    return (localStorage.getItem('site_settings_active_section') as any) || 'hero';
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    localStorage.setItem('site_settings_active_section', activeSection);
  }, [activeSection]);

  useEffect(() => {
    setFormData(config);
  }, [config]);

  const handleChange = (section: string, key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof prev],
        [key]: value
      }
    }));
  };

  const handleSocialChange = (key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      footer: {
        ...prev.footer,
        social_links: {
          ...prev.footer.social_links,
          [key]: value
        }
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await updateConfig(formData);
      setMessage({ type: 'success', text: 'Settings saved successfully' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">Site Configuration</h2>
        {message && (
          <div className={`flex items-center px-4 py-2 rounded-md text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message.type === 'success' ? <Check className="h-4 w-4 mr-2" /> : <AlertCircle className="h-4 w-4 mr-2" />}
            {message.text}
          </div>
        )}
      </div>

      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {['hero', 'header', 'footer', 'meta'].map((section) => (
            <button
              key={section}
              onClick={() => setActiveSection(section as any)}
              className={`${
                activeSection === section
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize`}
            >
              {section}
            </button>
          ))}
        </nav>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {activeSection === 'hero' && (
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Hero Title</label>
              <input
                type="text"
                value={formData.hero.title}
                onChange={e => handleChange('hero', 'title', e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Hero Subtitle</label>
              <input
                type="text"
                value={formData.hero.subtitle}
                onChange={e => handleChange('hero', 'subtitle', e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Hero Description</label>
              <textarea
                value={formData.hero.description}
                onChange={e => handleChange('hero', 'description', e.target.value)}
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Primary CTA Text</label>
                <input
                  type="text"
                  value={formData.hero.cta_primary_text}
                  onChange={e => handleChange('hero', 'cta_primary_text', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Primary CTA Link</label>
                <input
                  type="text"
                  value={formData.hero.cta_primary_link}
                  onChange={e => handleChange('hero', 'cta_primary_link', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Secondary CTA Text</label>
                <input
                  type="text"
                  value={formData.hero.cta_secondary_text}
                  onChange={e => handleChange('hero', 'cta_secondary_text', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Secondary CTA Link</label>
                <input
                  type="text"
                  value={formData.hero.cta_secondary_link}
                  onChange={e => handleChange('hero', 'cta_secondary_link', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {activeSection === 'header' && (
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Site Name</label>
              <input
                type="text"
                value={formData.header.site_name}
                onChange={e => handleChange('header', 'site_name', e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Logo URL</label>
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  value={formData.header.logo_url || ''}
                  onChange={e => handleChange('header', 'logo_url', e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                />
                <label className="flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
                   <Upload className="h-4 w-4 mr-2" />
                   Upload
                   <input 
                    type="file" 
                    className="hidden" 
                    accept="image/*"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        setMessage({ type: 'success', text: 'Uploading logo...' });
                        const resp = await uploadSiteLogo(f);
                        
                        // Prepare updated config
                        const updatedConfig = {
                            ...formData,
                            header: {
                                ...formData.header,
                                logo_url: resp.logo_url
                            }
                        };
                        
                        // Update local state
                        setFormData(updatedConfig);
                        
                        // Save immediately
                        await updateConfig(updatedConfig);
                        
                        setMessage({ type: 'success', text: 'Logo uploaded and saved successfully' });
                      } catch (err: any) {
                        console.error(err);
                        setMessage({ type: 'error', text: 'Failed to upload logo: ' + (err.message || 'Unknown error') });
                      }
                    }}
                   />
                </label>
                {formData.header.logo_url && (
                    <button 
                        type="button"
                        onClick={async () => {
                            if (!confirm('Remove site logo?')) return;
                            try {
                                await removeSiteLogo(formData.header.logo_url);
                                
                                const updatedConfig = {
                                    ...formData,
                                    header: {
                                        ...formData.header,
                                        logo_url: ''
                                    }
                                };
                                
                                setFormData(updatedConfig);
                                await updateConfig(updatedConfig);
                                setMessage({ type: 'success', text: 'Logo removed' });
                            } catch (e: any) {
                                console.error(e);
                                setMessage({ type: 'error', text: 'Failed to remove logo: ' + (e.message || 'Unknown error') });
                            }
                        }}
                        className="flex items-center justify-center px-4 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50"
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove
                    </button>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500">Leave empty to use the default icon. Or upload a file.</p>
              {formData.header.logo_url && (
                <div className="mt-2">
                  <p className="text-xs text-gray-500 mb-1">Preview:</p>
                  <img src={formData.header.logo_url} alt="Logo Preview" className="h-10 w-auto object-contain border p-1 rounded bg-gray-50" />
                </div>
              )}
            </div>
          </div>
        )}

        {activeSection === 'footer' && (
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Brand Description</label>
              <textarea
                value={formData.footer.brand_description}
                onChange={e => handleChange('footer', 'brand_description', e.target.value)}
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Contact Address</label>
                <textarea
                  value={formData.footer.contact_address}
                  onChange={e => handleChange('footer', 'contact_address', e.target.value)}
                  rows={2}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Contact Phone</label>
                <input
                  type="text"
                  value={formData.footer.contact_phone}
                  onChange={e => handleChange('footer', 'contact_phone', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Contact Email</label>
                <input
                  type="email"
                  value={formData.footer.contact_email}
                  onChange={e => handleChange('footer', 'contact_email', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                />
              </div>
            </div>
            <div className="border-t pt-6">
              <h3 className="text-sm font-medium text-gray-900 mb-4">Social Links</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Facebook</label>
                  <input
                    type="text"
                    value={formData.footer.social_links.facebook || ''}
                    onChange={e => handleSocialChange('facebook', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Twitter</label>
                  <input
                    type="text"
                    value={formData.footer.social_links.twitter || ''}
                    onChange={e => handleSocialChange('twitter', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Instagram</label>
                  <input
                    type="text"
                    value={formData.footer.social_links.instagram || ''}
                    onChange={e => handleSocialChange('instagram', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">LinkedIn</label>
                  <input
                    type="text"
                    value={formData.footer.social_links.linkedin || ''}
                    onChange={e => handleSocialChange('linkedin', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'meta' && (
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Site Title (Meta)</label>
              <input
                type="text"
                value={formData.meta.site_title}
                onChange={e => handleChange('meta', 'site_title', e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Site Description (Meta)</label>
              <textarea
                value={formData.meta.site_description}
                onChange={e => handleChange('meta', 'site_description', e.target.value)}
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Keywords (Comma separated)</label>
              <input
                type="text"
                value={formData.meta.keywords}
                onChange={e => handleChange('meta', 'keywords', e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end pt-6">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};
