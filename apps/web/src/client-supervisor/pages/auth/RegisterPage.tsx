import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { Building, User, Mail, Phone, Lock, ArrowRight, AlertCircle, MapPin } from 'lucide-react';

const registerSchema = z.object({
  company: z.string().min(2, 'Company name is required'),
  brand: z.string().min(2, 'Brand designation is required'),
  contactPerson: z.string().min(2, 'Contact person name is required'),
  designation: z.string().min(2, 'Designation / Title is required'),
  email: z.string().email('Please enter a valid business email address'),
  phone: z.string().min(10, 'Valid 10-digit phone number is required'),
  shippingPlant: z.string().min(10, 'Primary manufacturing/delivery plant address is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type RegisterFormData = z.infer<typeof registerSchema>;

export const RegisterPage: React.FC = () => {
  const { register: registerAuth } = useAuth();
  const { addToast } = useApp();
  const navigate = useNavigate();
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      company: 'Arvind Lifestyle Brands Ltd',
      brand: 'Flying Machine & Arrow',
      contactPerson: 'Sanjay Deshmukh',
      designation: 'Head of Sourcing',
      email: 's.deshmukh@arvindbrands.com',
      phone: '+91 98450 12890',
      shippingPlant: 'Arvind Garments Division, Naroda Road, Ahmedabad, Gujarat 380025',
      password: 'LoomPilot@2026',
    },
  });

  const onSubmit = async (data: RegisterFormData) => {
    setAuthError(null);
    const result = registerAuth({
      company: data.company,
      brand: data.brand,
      contactPerson: data.contactPerson,
      designation: data.designation,
      email: data.email,
      phone: data.phone,
      shippingPlant: data.shippingPlant,
      billingAddress: data.shippingPlant,
      password: data.password,
    });

    if (result.success) {
      addToast(`Enterprise client profile for ${data.company} registered!`, 'success');
      navigate('/client/dashboard');
    } else {
      setAuthError(result.error || 'Registration failed');
    }
  };

  return (
    <div className="min-h-screen bg-ivory flex flex-col justify-center py-10 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl text-center">
        <h2 className="text-3xl font-extrabold text-charcoal tracking-tight">
          Register Client Mill Entity
        </h2>
        <p className="mt-1 text-sm text-muted">
          Onboard your textile brand to access automated loom scheduling, quotations & tracking
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-xl px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-card rounded-2xl border border-muted-border sm:px-10">
          {authError && (
            <div className="mb-5 p-3 rounded-xl bg-vermilion/10 border border-vermilion/20 flex items-center gap-2 text-xs text-vermilion font-medium">
              <AlertCircle size={16} />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1">
                  Company Legal Entity
                </label>
                <div className="relative">
                  <Building size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="text"
                    {...register('company')}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-muted-border bg-ivory focus:bg-white focus:border-vermilion focus:outline-none"
                  />
                </div>
                {errors.company && <p className="mt-1 text-xs text-vermilion">{errors.company.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1">
                  Brand Division
                </label>
                <input
                  type="text"
                  {...register('brand')}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-muted-border bg-ivory focus:bg-white focus:border-vermilion focus:outline-none"
                />
                {errors.brand && <p className="mt-1 text-xs text-vermilion">{errors.brand.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1">
                  Procurement Lead Name
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="text"
                    {...register('contactPerson')}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-muted-border bg-ivory focus:bg-white focus:border-vermilion focus:outline-none"
                  />
                </div>
                {errors.contactPerson && <p className="mt-1 text-xs text-vermilion">{errors.contactPerson.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1">
                  Designation / Role
                </label>
                <input
                  type="text"
                  {...register('designation')}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-muted-border bg-ivory focus:bg-white focus:border-vermilion focus:outline-none"
                />
                {errors.designation && <p className="mt-1 text-xs text-vermilion">{errors.designation.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1">
                  Work Email Address
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="email"
                    {...register('email')}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-muted-border bg-ivory focus:bg-white focus:border-vermilion focus:outline-none"
                  />
                </div>
                {errors.email && <p className="mt-1 text-xs text-vermilion">{errors.email.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1">
                  Contact Phone
                </label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="tel"
                    {...register('phone')}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-muted-border bg-ivory focus:bg-white focus:border-vermilion focus:outline-none"
                  />
                </div>
                {errors.phone && <p className="mt-1 text-xs text-vermilion">{errors.phone.message}</p>}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1">
                Primary Delivery Plant / Warehouse Destination
              </label>
              <div className="relative">
                <MapPin size={16} className="absolute left-3 top-3 text-muted" />
                <textarea
                  rows={2}
                  {...register('shippingPlant')}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-muted-border bg-ivory focus:bg-white focus:border-vermilion focus:outline-none"
                />
              </div>
              {errors.shippingPlant && <p className="mt-1 text-xs text-vermilion">{errors.shippingPlant.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1">
                Create Portal Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="password"
                  {...register('password')}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-muted-border bg-ivory focus:bg-white focus:border-vermilion focus:outline-none"
                />
              </div>
              {errors.password && <p className="mt-1 text-xs text-vermilion">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-2.5 px-4 rounded-xl text-sm font-bold text-white bg-vermilion hover:bg-vermilion-hover shadow-vermilion transition-all flex items-center justify-center gap-2 group"
            >
              <span>Register & Enter Portal</span>
              <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-muted-border text-center">
            <p className="text-xs text-muted">
              Already have an enterprise account?{' '}
              <Link to="/client/login" className="font-bold text-vermilion hover:underline">
                Sign In Here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

