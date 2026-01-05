import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Users, Clock } from 'lucide-react';
import { useSiteSettings } from '../context/SiteSettingsContext';

export const Home: React.FC = () => {
  const { config } = useSiteSettings();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h1 className="text-4xl tracking-tight font-extrabold text-gray-900 sm:text-5xl md:text-6xl">
            <span className="block mt-[60px]">{config.hero.title}</span>
            <span className="block text-green-600">{config.hero.subtitle}</span>
          </h1>
          <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
            {config.hero.description}
          </p>
          <div className="mt-8 max-w-lg mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link to={config.hero.cta_primary_link} className="flex items-center justify-center px-8 py-4 border border-transparent text-lg font-semibold rounded-xl text-white bg-green-600 hover:bg-green-700 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1">
              <Calendar className="mr-2 h-5 w-5" />
              {config.hero.cta_primary_text}
            </Link>
            <Link to={config.hero.cta_secondary_link} className="flex items-center justify-center px-8 py-4 border border-transparent text-lg font-semibold rounded-xl text-white bg-teal-600 hover:bg-teal-700 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1">
              <Clock className="mr-2 h-5 w-5" />
              {config.hero.cta_secondary_text}
            </Link>
            <Link to="/my-appointments" className="flex items-center justify-center px-8 py-4 border-2 border-green-600 text-lg font-semibold rounded-xl text-green-700 bg-white hover:bg-green-50 shadow-md hover:shadow-lg transition-all transform hover:-translate-y-1">
              <Users className="mr-2 h-5 w-5" />
              My Appointments
            </Link>
            <Link to="/track-queue" className="flex items-center justify-center px-8 py-4 border-2 border-teal-600 text-lg font-semibold rounded-xl text-teal-700 bg-white hover:bg-teal-50 shadow-md hover:shadow-lg transition-all transform hover:-translate-y-1">
              <Clock className="mr-2 h-5 w-5" />
              Track Live Queue
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div className="pt-6">
              <div className="flow-root bg-white rounded-2xl px-6 pb-8 shadow-md hover:shadow-xl transition-shadow duration-300">
                <div className="-mt-6">
                  <div>
                    <span className="inline-flex items-center justify-center p-3 bg-green-600 rounded-xl shadow-lg transform transition-transform hover:scale-110">
                      <Calendar className="h-6 w-6 text-white" aria-hidden="true" />
                    </span>
                  </div>
                  <h3 className="mt-8 text-xl font-bold text-gray-900 tracking-tight">Easy Booking</h3>
                  <p className="mt-5 text-base text-gray-500">
                    Schedule your visit online and receive instant confirmation via SMS.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <div className="flow-root bg-white rounded-2xl px-6 pb-8 shadow-md hover:shadow-xl transition-shadow duration-300">
                <div className="-mt-6">
                  <div>
                    <span className="inline-flex items-center justify-center p-3 bg-green-600 rounded-xl shadow-lg transform transition-transform hover:scale-110">
                      <Clock className="h-6 w-6 text-white" aria-hidden="true" />
                    </span>
                  </div>
                  <h3 className="mt-8 text-xl font-bold text-gray-900 tracking-tight">Real-Time Status</h3>
                  <p className="mt-5 text-base text-gray-500">
                    Track your position in the queue from your phone. No more waiting in crowded halls.
                  </p>
                </div>
              </div>
            </div>

             <div className="pt-6">
              <div className="flow-root bg-white rounded-2xl px-6 pb-8 shadow-md hover:shadow-xl transition-shadow duration-300">
                <div className="-mt-6">
                  <div>
                    <span className="inline-flex items-center justify-center p-3 bg-green-600 rounded-xl shadow-lg transform transition-transform hover:scale-110">
                      <Users className="h-6 w-6 text-white" aria-hidden="true" />
                    </span>
                  </div>
                  <h3 className="mt-8 text-xl font-bold text-gray-900 tracking-tight">Clinician Efficiency</h3>
                  <p className="mt-5 text-base text-gray-500">
                    Doctors can manage patient flow efficiently with our integrated dashboard.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
