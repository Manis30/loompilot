import React from 'react';
import { User, ShieldCheck, Award, Phone, Mail, MapPin, Clock, Calendar } from 'lucide-react';
import { useSupervisor } from '../../context/SupervisorContext';

export const SupervisorProfilePage: React.FC = () => {
  const { profile } = useSupervisor();

  if (!profile) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center bg-white rounded-2xl border border-[#EAE2D9] text-gray-500 text-sm">
        Supervisor profile is unavailable. Please sign in to view shift records.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Profile Header Card */}
      <div className="bg-white rounded-2xl border border-[#EAE2D9] p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
        <div className="w-20 h-20 rounded-2xl bg-[#252622] text-white flex items-center justify-center font-black text-2xl shadow-lg shadow-[#252622]/20 flex-shrink-0">
          {profile.avatar}
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h1 className="text-2xl font-black text-[#252622]">{profile.name}</h1>
              <p className="text-xs font-semibold text-[#E65338]">{profile.title}</p>
            </div>
            <span className="inline-block px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#FBF6F0] border border-[#EAE2D9] text-[#252622]">
              {profile.empId}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-gray-600 pt-1">
            <span className="flex items-center gap-1">
              <Mail size={13} className="text-[#E65338]" /> {profile.email}
            </span>
            <span className="flex items-center gap-1">
              <Phone size={13} className="text-[#E65338]" /> {profile.phone}
            </span>
            <span className="flex items-center gap-1">
              <MapPin size={13} className="text-[#E65338]" /> {profile.facility}
            </span>
          </div>
        </div>
      </div>

      {/* Deployment & Shift Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-[#EAE2D9] shadow-sm space-y-3">
          <h2 className="text-sm font-extrabold text-[#252622] uppercase tracking-wider flex items-center gap-2">
            <Clock size={16} className="text-[#E65338]" />
            <span>Shift &amp; Operational Deployment</span>
          </h2>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1.5 border-b border-[#EAE2D9]">
              <span className="text-gray-500">Current Shift</span>
              <strong className="text-[#252622]">{profile.shift}</strong>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#EAE2D9]">
              <span className="text-gray-500">Department</span>
              <strong className="text-[#252622]">{profile.department}</strong>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#EAE2D9]">
              <span className="text-gray-500">Supervised Area</span>
              <strong className="text-[#252622]">{profile.area}</strong>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#EAE2D9]">
              <span className="text-gray-500">Reporting To</span>
              <strong className="text-[#252622]">{profile.reportingTo}</strong>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">Experience</span>
              <strong className="text-[#252622]">{profile.experience}</strong>
            </div>
          </div>
        </div>

        {/* Industry Certifications */}
        <div className="bg-white p-6 rounded-2xl border border-[#EAE2D9] shadow-sm space-y-3">
          <h2 className="text-sm font-extrabold text-[#252622] uppercase tracking-wider flex items-center gap-2">
            <Award size={16} className="text-[#20845A]" />
            <span>Textile &amp; SITRA Certifications</span>
          </h2>

          <div className="space-y-2">
            {profile.certifications.map((cert) => (
              <div
                key={cert}
                className="p-2.5 rounded-xl bg-[#FBF6F0] border border-[#EAE2D9] text-xs font-semibold text-gray-800 flex items-center gap-2"
              >
                <ShieldCheck size={15} className="text-[#20845A] flex-shrink-0" />
                <span>{cert}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

