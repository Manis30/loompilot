import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { PRODUCTION_STAGES_MASTER } from '../../data/mockData';
import { Order } from '../../types';
import { formatNumber } from '../../utils/formatters';
import {
  Check,
  ArrowRight,
  ArrowLeft,
  Upload,
  CheckCircle2,
  Package,
  Calendar,
  MapPin,
  FileText,
  Sparkles,
} from 'lucide-react';

const orderFormSchema = z.object({
  productType: z.enum(['catalogue', 'custom']),
  productId: z.string(),
  productName: z.string().min(2, 'Fabric name is required'),
  quantityMetres: z.number().min(1000, 'Minimum order quantity is 1,000 metres'),
  gsm: z.number().min(50, 'GSM must be at least 50').max(800, 'GSM cannot exceed 800'),
  widthInches: z.number().min(30).max(120),
  colorway: z.string().min(2, 'Please specify colorway or Pantone code'),
  construction: z.string().min(2, 'Weave construction is required'),
  specialFinish: z.string(),
  deliveryDate: z.string().min(5, 'Delivery date is required'),
  deliveryAddress: z.string().min(10, 'Delivery address is required'),
  shippingInstructions: z.string(),
});

type OrderFormData = z.infer<typeof orderFormSchema>;

export const CreateOrderPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const preSelectedId = searchParams.get('productId');
  const navigate = useNavigate();
  const { products, addOrder, addToast } = useApp();
  const { user } = useAuth();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [submittedOrder, setSubmittedOrder] = useState<Order | null>(null);

  // Default target date: 4 weeks from today
  const defaultDeliveryDate = new Date();
  defaultDeliveryDate.setDate(defaultDeliveryDate.getDate() + 28);
  const defaultDateStr = defaultDeliveryDate.toISOString().split('T')[0];

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<OrderFormData>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      productType: 'catalogue',
      productId: products[0]?.id || 'PROD-COTTON-40S',
      productName: products[0]?.name || '40s Combed Cotton 2/1 Twill',
      quantityMetres: 5000,
      gsm: 210,
      widthInches: 58,
      colorway: 'Navy Blue #19-4024 TCX',
      construction: '2/1 Twill',
      specialFinish: 'Mercerized, Pre-Shrunk (< 1.5%)',
      deliveryDate: defaultDateStr,
      deliveryAddress: user?.shippingPlant || 'Raymond Weaving Mills — Unit IV, Pokhran Road No. 1, Jekegram, Thane 400606',
      shippingInstructions: 'Palletized shrink-wrapped roll delivery with mill QC test certificate.',
    },
  });

  const formValues = watch();

  // If navigated with productId query param
  useEffect(() => {
    if (preSelectedId) {
      const prod = products.find((p) => p.id === preSelectedId);
      if (prod) {
        setValue('productId', prod.id);
        setValue('productName', prod.name);
        setValue('gsm', prod.gsm);
        setValue('widthInches', prod.widthInches);
        setValue('construction', prod.weave);
        setValue('quantityMetres', prod.moq);
        setValue('productType', prod.categoryCode === 'custom' ? 'custom' : 'catalogue');
      }
    }
  }, [preSelectedId, products, setValue]);

  const handleProductSelect = (prodId: string) => {
    const prod = products.find((p) => p.id === prodId);
    if (prod) {
      setValue('productId', prod.id);
      setValue('productName', prod.name);
      setValue('gsm', prod.gsm);
      setValue('widthInches', prod.widthInches);
      setValue('construction', prod.weave);
      setValue('quantityMetres', prod.moq);
    }
  };

  const handleNextStep = () => {
    if (currentStep < 4) setCurrentStep((prev) => prev + 1);
  };

  const handlePrevStep = () => {
    if (currentStep > 1) setCurrentStep((prev) => prev - 1);
  };

  const onSubmit = (data: OrderFormData) => {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderId = `LP-2026-${randomSuffix}`;

    const newOrder: Order = {
      id: orderId,
      productId: data.productId,
      productName: data.productName,
      category: data.productType === 'custom' ? 'Custom Textile' : 'Woven Fabrics',
      colorway: data.colorway,
      orderedMetres: data.quantityMetres,
      producedMetres: 0,
      remainingMetres: data.quantityMetres,
      progressPercent: 0,
      unitPrice: 225, // Mock baseline pending admin quote
      totalValue: data.quantityMetres * 225,
      orderDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      expectedDelivery: data.deliveryDate,
      currentStageNumber: 1,
      currentStageName: 'Quote Accepted',
      status: 'Awaiting Quotation',
      spotlight: false,
      specifications: {
        gsm: data.gsm,
        width: `${data.widthInches} inches`,
        yarnCount: 'Engineered spinning formulation',
        weave: data.construction,
        finish: data.specialFinish,
        packaging: 'Standard industrial roll packaging',
      },
      deliveryAddress: data.deliveryAddress,
      stages: PRODUCTION_STAGES_MASTER.map((s, idx) => ({
        step: s.step,
        name: s.name,
        status: idx === 0 ? 'active' : 'upcoming',
        date: idx === 0 ? 'Awaiting Quote Review' : 'Pending',
        notes: idx === 0 ? 'Order request received. Merchandiser is calculating loom capacity and pricing.' : 'Pending quote acceptance.',
      })),
      milestones: [
        {
          id: `MS-${randomSuffix}-1`,
          phase: 'Milestone 1 — 30% Advance on Acceptance',
          amount: Math.round(data.quantityMetres * 225 * 0.3),
          status: 'pending',
          invoiceId: `INV-2026-0${randomSuffix}`,
          dueDate: 'Upon Acceptance',
        },
        {
          id: `MS-${randomSuffix}-2`,
          phase: 'Milestone 2 — 40% Loom Weaving Milestone',
          amount: Math.round(data.quantityMetres * 225 * 0.4),
          status: 'upcoming',
          invoiceId: `INV-2026-0${randomSuffix + 1}`,
          dueDate: 'Mid Production',
        },
        {
          id: `MS-${randomSuffix}-3`,
          phase: 'Milestone 3 — 30% Pre-Dispatch Balance',
          amount: Math.round(data.quantityMetres * 225 * 0.3),
          status: 'upcoming',
          invoiceId: `INV-2026-0${randomSuffix + 2}`,
          dueDate: 'Prior Dispatch',
        },
      ],
    };

    addOrder(newOrder);
    setSubmittedOrder(newOrder);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-charcoal tracking-tight">
          Create Manufacturing Order
        </h1>
        <p className="text-sm text-muted mt-1">
          Configure fabric specifications, yardage volume, and mill delivery parameters for Admin quotation and loom allocation.
        </p>
      </div>

      {/* Stepper Navigation */}
      <div className="bg-white p-6 rounded-2xl border border-muted-border shadow-card">
        <div className="relative flex justify-between items-center">
          <div className="absolute top-4 left-6 right-6 h-0.5 bg-muted-border -z-0" />

          {[
            { step: 1, label: 'Select Fabric' },
            { step: 2, label: 'Specifications' },
            { step: 3, label: 'Delivery & Plant' },
            { step: 4, label: 'Review & Submit' },
          ].map((item) => {
            const isCompleted = currentStep > item.step;
            const isActive = currentStep === item.step;

            return (
              <div
                key={item.step}
                onClick={() => setCurrentStep(item.step)}
                className="relative z-10 flex flex-col items-center gap-1.5 cursor-pointer group"
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all border-2 ${
                    isActive
                      ? 'bg-vermilion text-white border-vermilion ring-4 ring-vermilion/20'
                      : isCompleted
                      ? 'bg-success text-white border-success'
                      : 'bg-white text-muted border-muted-border group-hover:border-muted'
                  }`}
                >
                  {isCompleted ? <Check size={16} strokeWidth={3} /> : item.step}
                </div>
                <span
                  className={`text-xs font-bold ${
                    isActive ? 'text-charcoal' : 'text-muted'
                  }`}
                >
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Form Card */}
      <div className="bg-white p-6 lg:p-8 rounded-2xl border border-muted-border shadow-card">
        <form onSubmit={handleSubmit(onSubmit)}>
          {/* STEP 1: Product Source */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div>
                <h3 className="text-lg font-extrabold text-charcoal">Step 1: Choose Product Source</h3>
                <p className="text-xs text-muted mt-0.5">
                  Select a verified fabric from our production catalogue or request a custom formulation.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  onClick={() => setValue('productType', 'catalogue')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    formValues.productType === 'catalogue'
                      ? 'border-vermilion bg-vermilion/5 shadow-sm'
                      : 'border-muted-border hover:bg-ivory'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-sm text-charcoal">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      formValues.productType === 'catalogue' ? 'border-vermilion' : 'border-muted-light'
                    }`}>
                      {formValues.productType === 'catalogue' && <div className="w-2 h-2 rounded-full bg-vermilion" />}
                    </div>
                    <span>Standard Catalogue Fabric</span>
                  </div>
                  <p className="text-xs text-muted mt-1 pl-6">
                    Choose from established mill specifications with validated yarn counts and proven lead times.
                  </p>
                </div>

                <div
                  onClick={() => {
                    setValue('productType', 'custom');
                    setValue('productId', 'PROD-CUSTOM-BESPOKE');
                    setValue('productName', 'Custom Mill-Engineered Weave');
                  }}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    formValues.productType === 'custom'
                      ? 'border-vermilion bg-vermilion/5 shadow-sm'
                      : 'border-muted-border hover:bg-ivory'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-sm text-charcoal">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      formValues.productType === 'custom' ? 'border-vermilion' : 'border-muted-light'
                    }`}>
                      {formValues.productType === 'custom' && <div className="w-2 h-2 rounded-full bg-vermilion" />}
                    </div>
                    <span>Custom Weave / Bespoke Blend</span>
                  </div>
                  <p className="text-xs text-muted mt-1 pl-6">
                    Request tailor-made fiber compositions (e.g., Silk-Linen, Tencel) with custom dobby/jacquard architectures.
                  </p>
                </div>
              </div>

              {formValues.productType === 'catalogue' ? (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5">
                    Select Catalogue Formulation
                  </label>
                  <select
                    value={formValues.productId}
                    onChange={(e) => handleProductSelect(e.target.value)}
                    className="w-full p-2.5 text-sm rounded-xl border border-muted-border bg-ivory focus:bg-white focus:border-vermilion focus:outline-none"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.category} — {p.gsm} GSM)
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5">
                      Custom Fabric Name / Reference
                    </label>
                    <input
                      type="text"
                      {...register('productName')}
                      placeholder="e.g. 60s Organic Cotton-Modal Satin"
                      className="w-full p-2.5 text-sm rounded-xl border border-muted-border bg-ivory focus:bg-white focus:border-vermilion focus:outline-none"
                    />
                    {errors.productName && <p className="mt-1 text-xs text-vermilion">{errors.productName.message}</p>}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-muted-border flex justify-between">
                <Link to="/client/products" className="px-4 py-2 rounded-xl text-xs font-bold border border-muted-border hover:bg-ivory text-charcoal">
                  Browse Catalogue
                </Link>
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-vermilion text-white text-xs font-bold shadow-vermilion hover:bg-vermilion-hover"
                >
                  <span>Proceed to Specifications</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Specifications */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div>
                <h3 className="text-lg font-extrabold text-charcoal">Step 2: Order Requirements & Fabric Specs</h3>
                <p className="text-xs text-muted mt-0.5">Define exact manufacturing yardage, weight, and finishes.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1">
                    Required Quantity (Metres)
                  </label>
                  <input
                    type="number"
                    step="500"
                    {...register('quantityMetres', { valueAsNumber: true })}
                    className="w-full p-2.5 text-sm rounded-xl border border-muted-border bg-ivory focus:bg-white focus:border-vermilion focus:outline-none font-bold"
                  />
                  {errors.quantityMetres && <p className="mt-1 text-xs text-vermilion">{errors.quantityMetres.message}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1">
                    Fabric Weight (GSM)
                  </label>
                  <input
                    type="number"
                    {...register('gsm', { valueAsNumber: true })}
                    className="w-full p-2.5 text-sm rounded-xl border border-muted-border bg-ivory focus:bg-white focus:border-vermilion focus:outline-none"
                  />
                  {errors.gsm && <p className="mt-1 text-xs text-vermilion">{errors.gsm.message}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1">
                    Finished Width (Inches)
                  </label>
                  <input
                    type="number"
                    {...register('widthInches', { valueAsNumber: true })}
                    className="w-full p-2.5 text-sm rounded-xl border border-muted-border bg-ivory focus:bg-white focus:border-vermilion focus:outline-none"
                  />
                  {errors.widthInches && <p className="mt-1 text-xs text-vermilion">{errors.widthInches.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1">
                    Shade / Pantone Reference
                  </label>
                  <input
                    type="text"
                    {...register('colorway')}
                    className="w-full p-2.5 text-sm rounded-xl border border-muted-border bg-ivory focus:bg-white focus:border-vermilion focus:outline-none"
                  />
                  {errors.colorway && <p className="mt-1 text-xs text-vermilion">{errors.colorway.message}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1">
                    Fabric Construction / Weave
                  </label>
                  <input
                    type="text"
                    {...register('construction')}
                    className="w-full p-2.5 text-sm rounded-xl border border-muted-border bg-ivory focus:bg-white focus:border-vermilion focus:outline-none"
                  />
                  {errors.construction && <p className="mt-1 text-xs text-vermilion">{errors.construction.message}</p>}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1">
                  Special Chemical Finish & Functional Treatments
                </label>
                <input
                  type="text"
                  {...register('specialFinish')}
                  placeholder="e.g. Mercerized, Teflon Stain Guard, Anti-Pilling, Flame Retardant"
                  className="w-full p-2.5 text-sm rounded-xl border border-muted-border bg-ivory focus:bg-white focus:border-vermilion focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1">
                  Upload Tech Pack / Swatch Spec Sheet (Optional)
                </label>
                <div
                  onClick={() => addToast('Reference spec sheet PDF attached.', 'success')}
                  className="p-5 border-2 border-dashed border-muted-border rounded-xl text-center bg-ivory hover:bg-white hover:border-vermilion cursor-pointer transition-colors"
                >
                  <Upload size={24} className="mx-auto text-muted mb-1" />
                  <span className="text-xs font-bold text-charcoal block">Click to attach technical spec sheet or CAD file</span>
                  <span className="text-[11px] text-muted">Supports PDF, PNG, CAD up to 25MB</span>
                </div>
              </div>

              <div className="pt-4 border-t border-muted-border flex justify-between">
                <button type="button" onClick={handlePrevStep} className="px-4 py-2 rounded-xl text-xs font-bold border border-muted-border hover:bg-ivory text-charcoal">
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-vermilion text-white text-xs font-bold shadow-vermilion hover:bg-vermilion-hover"
                >
                  <span>Proceed to Delivery Info</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Delivery Information */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div>
                <h3 className="text-lg font-extrabold text-charcoal">Step 3: Delivery Information & Plant Destination</h3>
                <p className="text-xs text-muted mt-0.5">Specify delivery deadline, mill warehouse, and shipping parameters.</p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1">
                  Required Delivery Deadline
                </label>
                <input
                  type="date"
                  {...register('deliveryDate')}
                  className="w-full p-2.5 text-sm rounded-xl border border-muted-border bg-ivory focus:bg-white focus:border-vermilion focus:outline-none"
                />
                {errors.deliveryDate && <p className="mt-1 text-xs text-vermilion">{errors.deliveryDate.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1">
                  Destination Mill / Factory Warehouse Address
                </label>
                <textarea
                  rows={3}
                  {...register('deliveryAddress')}
                  className="w-full p-2.5 text-sm rounded-xl border border-muted-border bg-ivory focus:bg-white focus:border-vermilion focus:outline-none"
                />
                {errors.deliveryAddress && <p className="mt-1 text-xs text-vermilion">{errors.deliveryAddress.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1">
                  Special Logistics & Inspection Instructions
                </label>
                <textarea
                  rows={2}
                  {...register('shippingInstructions')}
                  className="w-full p-2.5 text-sm rounded-xl border border-muted-border bg-ivory focus:bg-white focus:border-vermilion focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-muted-border flex justify-between">
                <button type="button" onClick={handlePrevStep} className="px-4 py-2 rounded-xl text-xs font-bold border border-muted-border hover:bg-ivory text-charcoal">
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-vermilion text-white text-xs font-bold shadow-vermilion hover:bg-vermilion-hover"
                >
                  <span>Review Complete Order</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Review and Submit */}
          {currentStep === 4 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div>
                <h3 className="text-lg font-extrabold text-charcoal">Step 4: Review Order Summary & Commercial Terms</h3>
                <p className="text-xs text-muted mt-0.5">Confirm manufacturing details before submitting for official quotation.</p>
              </div>

              <div className="p-5 rounded-2xl bg-ivory border border-muted-border space-y-3 text-xs">
                <div className="flex justify-between py-1 border-b border-muted-border/60">
                  <span className="text-muted">Selected Fabric</span>
                  <strong className="text-charcoal text-sm">{formValues.productName}</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-muted-border/60">
                  <span className="text-muted">Order Volume</span>
                  <strong className="text-vermilion text-sm">{formatNumber(formValues.quantityMetres)} metres</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-muted-border/60">
                  <span className="text-muted">Weight & Finished Width</span>
                  <strong className="text-charcoal">{formValues.gsm} GSM • {formValues.widthInches}" Finished Width</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-muted-border/60">
                  <span className="text-muted">Colorway / Shade</span>
                  <strong className="text-charcoal">{formValues.colorway}</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-muted-border/60">
                  <span className="text-muted">Weave Architecture</span>
                  <strong className="text-charcoal">{formValues.construction}</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-muted-border/60">
                  <span className="text-muted">Target Delivery Date</span>
                  <strong className="text-charcoal">{formValues.deliveryDate}</strong>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted">Delivery Mill Facility</span>
                  <strong className="text-charcoal text-right max-w-sm truncate">{formValues.deliveryAddress}</strong>
                </div>
              </div>

              {/* Commercial Assurance Box */}
              <div className="p-4 rounded-xl bg-success-bg border border-success-border text-xs text-[#16573B] flex gap-3">
                <Sparkles size={18} className="text-success flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Commercial Workflow Assurance:</strong> Upon submission, this request enters <strong>Awaiting Quotation</strong>. LoomPilot's merchandising team prepares a binding price per metre and capacity schedule. You can negotiate price or delivery terms directly via chat before accepting and triggering Stage 1 (Advance Invoice).
                </div>
              </div>

              <div className="pt-4 border-t border-muted-border flex justify-between items-center">
                <button type="button" onClick={handlePrevStep} className="px-4 py-2 rounded-xl text-xs font-bold border border-muted-border hover:bg-ivory text-charcoal">
                  Back
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => addToast('Order saved as draft in local cache.', 'info')}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold border border-muted-border hover:bg-ivory text-charcoal"
                  >
                    Save as Draft
                  </button>

                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-vermilion text-white text-sm font-bold shadow-vermilion hover:bg-vermilion-hover transition-colors"
                  >
                    <span>Submit Manufacturing Order</span>
                    <Check size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Confirmation Modal */}
      {submittedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 text-center space-y-4 animate-in zoom-in-95 border border-muted-border">
            <div className="w-14 h-14 rounded-full bg-success-bg text-success flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} />
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-success">Order Submitted Successfully</span>
              <h2 className="text-xl font-extrabold text-charcoal mt-1">Ref: {submittedOrder.id}</h2>
              <p className="text-xs text-muted mt-1 max-w-xs mx-auto">
                Your manufacturing request for <strong>{formatNumber(submittedOrder.orderedMetres)}m of {submittedOrder.productName}</strong> has been logged with LoomPilot Mill Operations.
              </p>
            </div>

            <div className="p-3 bg-ivory rounded-xl border border-muted-border text-left text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-muted">Initial Lifecycle Status:</span>
                <span className="px-2 py-0.5 rounded-full bg-warning/10 text-warning font-bold text-[11px]">
                  Awaiting Quotation
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Next Action:</span>
                <strong className="text-charcoal">Admin Quote Review & Counter-Offer</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Target Dispatch:</span>
                <strong className="text-charcoal">{submittedOrder.expectedDelivery}</strong>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                onClick={() => navigate('/client/orders')}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-muted-border hover:bg-ivory text-charcoal"
              >
                View in My Orders
              </button>
              <button
                onClick={() => navigate('/client/messages')}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-vermilion hover:bg-vermilion-hover shadow-vermilion"
              >
                Open Negotiation Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

