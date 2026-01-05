import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { type SiteConfig, getSiteConfig, updateSiteConfig } from '../services/api';

const defaultSiteConfig: SiteConfig = {
  hero: {
    title: 'Out-Patient Queue',
    subtitle: 'Management System',
    description: 'Streamline your hospital visit. Book appointments, check live queue status, and save time.',
    cta_primary_text: 'Book Appointment',
    cta_primary_link: '/book',
    cta_secondary_text: 'Self Check-in',
    cta_secondary_link: '/check-in',
  },
  header: {
    site_name: 'OPD-QMS',
    logo_url: ''
  },
  footer: {
    brand_description: 'Streamlining healthcare delivery with efficient queue management. Reducing wait times and improving patient experience at LASUTH.',
    contact_address: '1-5 Oba Akinjobi Way, Ikeja, Lagos State, Nigeria',
    contact_phone: '+234 800 LASUTH',
    contact_email: 'info@lasuth.org.ng',
    social_links: {
      facebook: '#',
      twitter: '#',
      instagram: '#',
      linkedin: '#'
    }
  },
  meta: {
    site_title: 'OPD Queue Management System',
    site_description: 'Efficient outpatient department queue management system.',
    keywords: 'hospital, queue, appointment, medical, health'
  }
};

interface SiteSettingsContextType {
  config: SiteConfig;
  loading: boolean;
  refreshConfig: () => Promise<void>;
  updateConfig: (updates: Partial<SiteConfig>) => Promise<SiteConfig>;
}

const SiteSettingsContext = createContext<SiteSettingsContextType | undefined>(undefined);

export const SiteSettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<SiteConfig>(defaultSiteConfig);
  const [loading, setLoading] = useState(true);

  const fetchConfig = async () => {
    try {
      const data = await getSiteConfig();
      setConfig(data);
      // Update document title and meta tags
      document.title = data.meta.site_title;
      // We could update meta tags here too if needed
    } catch (err) {
      console.error('Failed to fetch site config:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const updateConfig = async (updates: Partial<SiteConfig>) => {
    const updated = await updateSiteConfig(updates);
    setConfig(updated);
    document.title = updated.meta.site_title;
    return updated;
  };

  return (
    <SiteSettingsContext.Provider value={{ config, loading, refreshConfig: fetchConfig, updateConfig }}>
      {children}
    </SiteSettingsContext.Provider>
  );
};

export const useSiteSettings = () => {
  const context = useContext(SiteSettingsContext);
  if (context === undefined) {
    throw new Error('useSiteSettings must be used within a SiteSettingsProvider');
  }
  return context;
};
