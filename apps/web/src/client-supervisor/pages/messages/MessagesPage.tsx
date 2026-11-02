import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/formatters';
import {
  Send,
  Paperclip,
  CheckCircle2,
  Clock,
  Sparkles,
  ShieldCheck,
  TrendingDown,
  ArrowRight,
  Bot,
  User,
  Building,
  AlertCircle,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { useGetClientOrdersQuery } from '../../../store/api/ordersApi';
import { ChatThread } from '../../types';

const isDemo = (import.meta as any).env?.VITE_ENABLE_DEMO_LOGIN === 'true';

export const MessagesPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const queryOrderId = searchParams.get('orderId');
  const navigate = useNavigate();
  const {
    chats: localChats,
    sendChatMessage,
    acceptQuotation,
    addToast,
    isChatSending,
    chatError,
    clearChatError,
  } = useApp();

  const {
    data: ordersResponse,
    isLoading: isOrdersLoading,
    isError: isOrdersError,
    refetch: refetchOrders,
  } = useGetClientOrdersQuery(undefined);

  const chats = useMemo<Record<string, ChatThread>>(() => {
    if (isDemo) {
      return localChats;
    }
    const rawOrders = ordersResponse?.data || [];
    if (Array.isArray(rawOrders) && rawOrders.length > 0) {
      const map: Record<string, ChatThread> = {};
      rawOrders.forEach((o: any) => {
        const id = o.orderNumber || String(o._id || o.id).slice(-8).toUpperCase();
        const unitPrice = o.quotation?.unitPricePaise
          ? formatCurrency(o.quotation.unitPricePaise / 100) + ' / m'
          : (o.unitPrice ? formatCurrency(o.unitPrice) + ' / m' : 'Awaiting Quote');
        const total = o.quotation?.totalPaise
          ? formatCurrency(o.quotation.totalPaise / 100)
          : (o.totalValue ? formatCurrency(o.totalValue) : 'TBD');
        const qty = o.quantity ? `${Number(o.quantity).toLocaleString()} metres` : 'Custom volume';
        const delivery = o.deliveryDeadline
          ? new Date(o.deliveryDeadline).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
          : 'In 4 weeks';

        map[id] = {
          orderId: id,
          productName: o.productDescription || o.styleName || o.spec?.fabric || 'Custom Apparel Textile',
          orderQuantity: qty,
          quotedPrice: unitPrice,
          totalQuote: total,
          validity: o.quotation?.validUntil
            ? `Valid until ${new Date(o.quotation.validUntil).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
            : 'Quote in review',
          deliveryDate: delivery,
          status: o.status === 'in_production' ? 'In Production' : o.status === 'submitted' ? 'Awaiting Quotation' : (o.status || 'Active Contract'),
          unread: false,
          messages: [],
        };
      });
      return map;
    }
    return {};
  }, [ordersResponse, localChats]);

  const orderIds = Object.keys(chats);
  const [selectedOrderId, setSelectedOrderId] = useState<string>(queryOrderId || '');
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Synchronize selectedOrderId with available order threads
  useEffect(() => {
    if (queryOrderId && chats[queryOrderId]) {
      setSelectedOrderId(queryOrderId);
    } else if (!selectedOrderId || !chats[selectedOrderId]) {
      if (orderIds.length > 0) {
        setSelectedOrderId(orderIds[0]);
      }
    }
  }, [queryOrderId, chats, orderIds, selectedOrderId]);

  const activeChat = selectedOrderId ? chats[selectedOrderId] : (orderIds.length > 0 ? chats[orderIds[0]] : undefined);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.messages]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || !selectedOrderId || isChatSending) return;

    const ok = await sendChatMessage(selectedOrderId, text);
    if (ok) {
      setInputText('');
    }
  };

  const handleQuickPrompt = async (promptText: string) => {
    if (!selectedOrderId || isChatSending) return;
    await sendChatMessage(selectedOrderId, promptText);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-charcoal tracking-tight">
          Quotations & Negotiation Workspace
        </h1>
        <p className="text-sm text-muted mt-1">
          Collaborate with LoomPilot AI concierge and Senior Mill Merchandisers on price per metre, delivery windows, and binding contracts.
        </p>
      </div>

      {/* Two-Panel Chat Workspace */}
      <div className="bg-white rounded-2xl border border-muted-border shadow-card overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[680px]">
        {/* Left Panel: Conversation Threads (4 cols) */}
        <div className="lg:col-span-4 border-r border-muted-border bg-ivory/40 flex flex-col">
          <div className="p-4 border-b border-muted-border bg-white flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-charcoal">Active Order Threads</h3>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-ivory text-muted border border-muted-border">
              {orderIds.length} Threads
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {!isDemo && isOrdersLoading && (
              <div className="py-12 text-center text-xs text-muted flex items-center justify-center gap-2">
                <Loader2 className="animate-spin text-vermilion" size={16} />
                <span>Loading active order threads...</span>
              </div>
            )}

            {!isDemo && isOrdersError && (
              <div className="p-4 text-center text-xs text-danger space-y-2">
                <div>Failed to load order threads from server.</div>
                <button
                  type="button"
                  onClick={() => refetchOrders()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-danger text-white text-[11px] font-bold"
                >
                  <RefreshCw size={11} />
                  <span>Retry</span>
                </button>
              </div>
            )}

            {!isOrdersLoading && !isOrdersError && orderIds.length === 0 && (
              <div className="py-12 text-center text-xs text-muted space-y-1">
                <div className="font-bold text-charcoal">No Order Threads Found</div>
                <p className="text-[11px] text-muted max-w-[200px] mx-auto">
                  Submit a manufacturing order to initiate price and delivery negotiations.
                </p>
              </div>
            )}

            {orderIds.map((id) => {
              const chat = chats[id];
              const isSelected = id === selectedOrderId;

              return (
                <div
                  key={id}
                  onClick={() => {
                    setSelectedOrderId(id);
                    clearChatError();
                  }}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-charcoal text-white border-charcoal shadow-md'
                      : 'bg-white border-muted-border hover:border-muted text-charcoal'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-mono text-xs font-bold ${isSelected ? 'text-white' : 'text-vermilion'}`}>
                      {id}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : chat.status.includes('Approved')
                          ? 'bg-warning-bg text-warning'
                          : 'bg-success-bg text-success'
                      }`}
                    >
                      {chat.status}
                    </span>
                  </div>

                  <div className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-charcoal'}`}>
                    {chat.productName}
                  </div>

                  <div className={`text-[11px] mt-1 ${isSelected ? 'text-gray-300' : 'text-muted'}`}>
                    {chat.quotedPrice} • {chat.orderQuantity}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Panel: Conversation Stream (8 cols) */}
        <div className="lg:col-span-8 flex flex-col bg-white">
          {activeChat ? (
            <>
              {/* Order Context Header Bar */}
              <div className="p-4 bg-ivory border-b border-muted-border flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted block">Contract Reference</span>
                    <strong className="text-charcoal font-bold font-mono">{activeChat.orderId}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted block">Fabric Formulation</span>
                    <strong className="text-charcoal font-bold">{activeChat.productName}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted block">Volume</span>
                    <strong className="text-charcoal font-bold">{activeChat.orderQuantity}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted block">Current Rate</span>
                    <strong className="text-vermilion font-bold">{activeChat.quotedPrice}</strong>
                  </div>
                </div>

                {activeChat.status.includes('Approved') && (
                  <button
                    onClick={() => {
                      acceptQuotation(activeChat.orderId);
                      navigate('/client/payments');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success text-white text-xs font-bold hover:bg-[#1A6C49] shadow-sm transition-colors"
                  >
                    <CheckCircle2 size={14} />
                    <span>Accept Quotation</span>
                  </button>
                )}
              </div>

              {/* Service Status & Error Banners */}
              <div className="px-4 pt-4 space-y-2">
                {!isDemo && (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-charcoal text-xs flex items-start gap-2.5">
                    <Bot size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-amber-900 block">AI Concierge & Negotiation Service Unavailable</span>
                      <span className="text-amber-800 text-[11px] leading-relaxed">
                        Real-time AI agent conversation endpoints (/api/v1/client/conversations) are not deployed on the mill server. Automated quote negotiations and assistant responses are currently offline.
                      </span>
                    </div>
                  </div>
                )}

                {chatError && (
                  <div className="p-3 rounded-xl bg-danger-bg border border-danger/20 text-danger text-xs flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={15} className="flex-shrink-0" />
                      <span>{chatError}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSend()}
                        disabled={isChatSending}
                        className="px-2.5 py-1 rounded-lg bg-danger text-white text-[11px] font-bold hover:bg-danger/90 transition-colors inline-flex items-center gap-1"
                      >
                        <RefreshCw size={11} />
                        <span>Retry</span>
                      </button>
                      <button
                        type="button"
                        onClick={clearChatError}
                        className="px-2 py-1 rounded-lg text-xs font-bold text-muted hover:text-charcoal"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Message Stream */}
              <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4 bg-ivory/20">
                {activeChat.messages.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-2 text-muted min-h-[260px]">
                    <Bot size={36} className="opacity-40" />
                    <div className="text-xs font-bold text-charcoal">No Conversation History</div>
                    <p className="text-[11px] text-muted max-w-sm">
                      {isDemo
                        ? 'Type a message below to start negotiation with the AI Concierge.'
                        : 'Persisted conversation history is unavailable. Live AI agent conversation endpoints are not deployed in this environment.'}
                    </p>
                  </div>
                ) : (
                  activeChat.messages.map((msg) => {
                    const isUser = msg.sender === 'user';
                    const isAdmin = msg.sender === 'admin';

                    return (
                      <div
                        key={msg.id}
                        className={`flex gap-3 max-w-[85%] ${isUser ? 'ml-auto flex-row-reverse' : ''}`}
                      >
                        {/* Avatar */}
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                            isUser
                              ? 'bg-vermilion text-white'
                              : isAdmin
                              ? 'bg-[#1C4D79] text-white'
                              : 'bg-charcoal text-white'
                          }`}
                        >
                          {isUser ? <User size={15} /> : isAdmin ? <Building size={15} /> : <Bot size={15} />}
                        </div>

                        {/* Content Bubble */}
                        <div className="space-y-1">
                          <div className={`flex items-center gap-2 text-[11px] ${isUser ? 'justify-end' : ''}`}>
                            <strong className="text-charcoal font-bold">{msg.senderName}</strong>
                            <span className="text-muted-light">{msg.time}</span>
                            {msg.badge && (
                              <span className="px-2 py-0.5 rounded-full bg-warning-bg text-warning text-[10px] font-bold">
                                {msg.badge}
                              </span>
                            )}
                          </div>

                          <div
                            className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                              isUser
                                ? 'bg-charcoal text-white rounded-tr-none'
                                : 'bg-white border border-muted-border text-charcoal shadow-sm rounded-tl-none'
                            }`}
                          >
                            <p>{msg.text}</p>

                            {/* Formal Quote Revision Box */}
                            {msg.revisedData && (
                              <div className="mt-3 p-3.5 rounded-xl bg-ivory border border-warning text-charcoal space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-warning">
                                    Official Revised Offer
                                  </span>
                                  <span className="px-2 py-0.5 rounded-full bg-success-bg text-success text-[10px] font-bold inline-flex items-center gap-1">
                                    <TrendingDown size={11} />
                                    Saves {msg.revisedData.savings}
                                  </span>
                                </div>

                                <div className="flex items-baseline gap-2">
                                  <span className="text-xs text-muted line-through">{msg.revisedData.originalRate}</span>
                                  <span className="text-lg font-extrabold text-success">{msg.revisedData.newRate}</span>
                                  <span className="text-xs font-bold text-charcoal">
                                    (Revised Total: {msg.revisedData.newTotal})
                                  </span>
                                </div>

                                <p className="text-[11px] text-muted">
                                  Approved by Anil Sharma. Locks preferential spinning & loom allocation upon acceptance.
                                </p>

                                <button
                                  onClick={() => {
                                    acceptQuotation(activeChat.orderId);
                                    navigate('/client/payments');
                                  }}
                                  className="w-full py-2 px-3 rounded-lg bg-success text-white text-xs font-bold hover:bg-[#1A6C49] transition-colors"
                                >
                                  Accept This Revised Quote & Start Production
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Negotiation Action Prompts */}
              <div className="px-4 py-2 border-t border-muted-border bg-white flex items-center gap-2 overflow-x-auto scrollbar-none">
                <span className="text-[11px] font-bold text-muted flex-shrink-0">Shortcuts:</span>
                <button
                  type="button"
                  disabled={isChatSending}
                  onClick={() => handleQuickPrompt('Can you reduce the quotation price given our bulk commitment?')}
                  className="px-3 py-1 rounded-full text-[11px] font-semibold bg-ivory border border-muted-border hover:border-vermilion hover:text-vermilion whitespace-nowrap transition-colors disabled:opacity-50"
                >
                  💰 Request Bulk Discount
                </button>
                <button
                  type="button"
                  disabled={isChatSending}
                  onClick={() => handleQuickPrompt('Can we expedite the delivery deadline by 1 week?')}
                  className="px-3 py-1 rounded-full text-[11px] font-semibold bg-ivory border border-muted-border hover:border-vermilion hover:text-vermilion whitespace-nowrap transition-colors disabled:opacity-50"
                >
                  ⏱ Expedite Delivery Date
                </button>
                <button
                  type="button"
                  disabled={isChatSending}
                  onClick={() => handleQuickPrompt('Can you provide lab dip shade swatches before loom beaming?')}
                  className="px-3 py-1 rounded-full text-[11px] font-semibold bg-ivory border border-muted-border hover:border-vermilion hover:text-vermilion whitespace-nowrap transition-colors disabled:opacity-50"
                >
                  🎨 Request Lab Swatches
                </button>
              </div>

              {/* Chat Input Bar */}
              <form onSubmit={handleSend} className="p-3.5 border-t border-muted-border bg-white flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => addToast('Reference spec sheet or PO attached.', 'info')}
                  className="p-2 rounded-xl text-muted hover:text-charcoal hover:bg-ivory transition-colors"
                  title="Attach Spec Sheet"
                >
                  <Paperclip size={18} />
                </button>

                <input
                  type="text"
                  value={inputText}
                  disabled={isChatSending}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={
                    isDemo
                      ? "Type your negotiation inquiry, volume counter-offer, or spec question..."
                      : "Type your inquiry (AI Concierge service is currently offline)..."
                  }
                  className="flex-1 px-4 py-2 text-xs rounded-full border border-muted-border bg-ivory focus:bg-white focus:border-vermilion focus:outline-none disabled:opacity-60"
                />

                <button
                  type="submit"
                  disabled={!inputText.trim() || isChatSending}
                  className="px-4 py-2 rounded-full bg-vermilion hover:bg-vermilion-hover text-white text-xs font-bold shadow-vermilion disabled:opacity-50 transition-all inline-flex items-center gap-1.5 flex-shrink-0"
                >
                  {isChatSending ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <span>Send</span>
                      <Send size={13} />
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-xs text-muted space-y-1">
              <div className="font-bold text-charcoal">No Active Thread Selected</div>
              <p className="text-[11px] text-muted max-w-sm">
                Select an order thread from the left panel to open the negotiation workspace.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
