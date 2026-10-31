import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';

export const MessagesPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const queryOrderId = searchParams.get('orderId');
  const navigate = useNavigate();
  const { chats, sendChatMessage, acceptQuotation, addToast } = useApp();

  const orderIds = Object.keys(chats);
  const [selectedOrderId, setSelectedOrderId] = useState<string>(
    queryOrderId || orderIds[0] || 'LP-2026-8854'
  );
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeChat = chats[selectedOrderId] || chats[orderIds[0]];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.messages]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || !selectedOrderId) return;

    sendChatMessage(selectedOrderId, text);
    setInputText('');
  };

  const handleQuickPrompt = (promptText: string) => {
    if (!selectedOrderId) return;
    sendChatMessage(selectedOrderId, promptText);
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
            {orderIds.map((id) => {
              const chat = chats[id];
              const isSelected = id === selectedOrderId;

              return (
                <div
                  key={id}
                  onClick={() => setSelectedOrderId(id)}
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

              {/* Message Stream */}
              <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4 bg-ivory/20">
                {activeChat.messages.map((msg) => {
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
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Negotiation Action Prompts */}
              <div className="px-4 py-2 border-t border-muted-border bg-white flex items-center gap-2 overflow-x-auto scrollbar-none">
                <span className="text-[11px] font-bold text-muted flex-shrink-0">Shortcuts:</span>
                <button
                  type="button"
                  onClick={() => handleQuickPrompt('Can you reduce the quotation price given our bulk commitment?')}
                  className="px-3 py-1 rounded-full text-[11px] font-semibold bg-ivory border border-muted-border hover:border-vermilion hover:text-vermilion whitespace-nowrap transition-colors"
                >
                  💰 Request Bulk Discount
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPrompt('Can we expedite the delivery deadline by 1 week?')}
                  className="px-3 py-1 rounded-full text-[11px] font-semibold bg-ivory border border-muted-border hover:border-vermilion hover:text-vermilion whitespace-nowrap transition-colors"
                >
                  ⏱ Expedite Delivery Date
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPrompt('Can you provide lab dip shade swatches before loom beaming?')}
                  className="px-3 py-1 rounded-full text-[11px] font-semibold bg-ivory border border-muted-border hover:border-vermilion hover:text-vermilion whitespace-nowrap transition-colors"
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
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Type your negotiation inquiry, volume counter-offer, or spec question..."
                  className="flex-1 px-4 py-2 text-xs rounded-full border border-muted-border bg-ivory focus:bg-white focus:border-vermilion focus:outline-none"
                />

                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="px-4 py-2 rounded-full bg-vermilion hover:bg-vermilion-hover text-white text-xs font-bold shadow-vermilion disabled:opacity-50 transition-all inline-flex items-center gap-1.5"
                >
                  <span>Send</span>
                  <Send size={13} />
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-xs text-muted">
              Select an order thread to open negotiation workspace
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

