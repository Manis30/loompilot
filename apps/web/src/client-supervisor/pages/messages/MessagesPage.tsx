import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
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
import { ChatThread, ChatMessage } from '../../types';
import { useGetClientOrdersQuery } from '../../../store/api/ordersApi';
import {
  useGetClientOrderChatQuery,
  useSendClientOrderMessageMutation,
} from '../../../store/api/chatApi';

const isDemo = (import.meta as any).env?.VITE_ENABLE_DEMO_LOGIN === 'true';

export const MessagesPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const queryOrderId = searchParams.get('orderId');
  const navigate = useNavigate();
  const {
    chats: localChats,
    sendChatMessage: demoSendChatMessage,
    acceptQuotation,
    addToast,
    isChatSending,
  } = useApp();

  // 1. Live Orders Query for active customer orders
  const { data: clientOrdersRes, refetch: refetchOrders } = useGetClientOrdersQuery();
  const liveOrders = clientOrdersRes?.data || [];

  // Compute chats dictionary from live orders or demo fallback
  const chats = useMemo<Record<string, ChatThread>>(() => {
    const threadMap: Record<string, ChatThread> = {};

    if (Array.isArray(liveOrders) && liveOrders.length > 0) {
      for (const ord of liveOrders) {
        const ordId = (ord as any).id || (ord as any)._id || (ord as any).orderNumber;
        threadMap[ordId] = {
          orderId: ordId,
          productName: (ord as any).productName || (ord as any).productDescription || 'Custom Woven Line',
          orderQuantity: `${((ord as any).quantity || 1000).toLocaleString()} pcs`,
          quotedPrice: `₹${(((ord as any).quotation?.unitPricePaise || 28500) / 100).toFixed(2)}/m`,
          totalQuote: `₹${(((ord as any).quotation?.totalPaise || 2850000) / 100).toLocaleString('en-IN')}`,
          validity: '14 Days Valid',
          deliveryDate: (ord as any).deliveryDeadline || 'Upcoming',
          status: (ord as any).status || 'Quote Review',
          unread: false,
          messages: [],
        };
      }
    }

    if (Object.keys(threadMap).length === 0 && isDemo) {
      return localChats;
    }
    return threadMap;
  }, [liveOrders, localChats]);

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
        setSelectedOrderId(orderIds[0]!);
      }
    }
  }, [queryOrderId, chats, orderIds, selectedOrderId]);

  // 2. Live Conversation Query & Mutation
  const {
    data: liveChatRes,
    isLoading: isChatLoading,
    refetch: refetchLiveChat,
  } = useGetClientOrderChatQuery(selectedOrderId, {
    skip: !selectedOrderId,
  });

  const [sendOrderMessageMutation, { isLoading: isSendingLiveMessage }] =
    useSendClientOrderMessageMutation();

  const activeChat = selectedOrderId ? chats[selectedOrderId] : (orderIds.length > 0 ? chats[orderIds[0]!] : undefined);

  // Derive message list from live backend conversation if available
  const messagesToDisplay: ChatMessage[] = useMemo(() => {
    const rawMessages = liveChatRes?.data?.messages;
    if (Array.isArray(rawMessages) && rawMessages.length > 0) {
      return rawMessages.map((m, idx) => ({
        id: m.id || `live_${idx}_${Date.now()}`,
        sender: m.senderType === 'client' ? 'user' : m.senderType === 'admin' ? 'admin' : 'assistant',
        senderName:
          m.senderType === 'client'
            ? 'You'
            : m.senderType === 'admin'
            ? 'Senior Merchandiser (Admin)'
            : 'LoomPilot AI Concierge',
        avatar: m.senderType === 'client' ? 'user' : m.senderType === 'admin' ? 'admin' : 'ai',
        time: m.createdAt
          ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : 'Today',
        text: m.text,
      }));
    }

    if (activeChat?.messages && activeChat.messages.length > 0) {
      return activeChat.messages;
    }

    return [];
  }, [liveChatRes, activeChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesToDisplay.length]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || !selectedOrderId || isChatSending || isSendingLiveMessage) return;

    try {
      await sendOrderMessageMutation({ orderId: selectedOrderId, message: text }).unwrap();
      setInputText('');
      refetchLiveChat();
    } catch (_err) {
      if (isDemo) {
        await demoSendChatMessage(selectedOrderId, text);
        setInputText('');
      } else {
        addToast('Failed to deliver message to merchandising desk', 'error');
      }
    }
  };

  const handleQuickPrompt = async (promptText: string) => {
    if (!selectedOrderId || isChatSending || isSendingLiveMessage) return;
    try {
      await sendOrderMessageMutation({ orderId: selectedOrderId, message: promptText }).unwrap();
      refetchLiveChat();
    } catch (_err) {
      if (isDemo) {
        await demoSendChatMessage(selectedOrderId, promptText);
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-charcoal tracking-tight">
          Quotations &amp; Negotiation Workspace
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
            <h3 className="text-xs font-bold uppercase tracking-wider text-charcoal">Active Conversations</h3>
            <button
              onClick={() => {
                refetchOrders();
                refetchLiveChat();
              }}
              className="text-xs text-muted hover:text-charcoal flex items-center gap-1 font-semibold"
            >
              <RefreshCw size={12} />
              <span>Sync</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-muted-border/60">
            {orderIds.length === 0 ? (
              <div className="p-8 text-center text-muted text-xs">
                No active orders found. Create an enquiry to begin merchandising conversations.
              </div>
            ) : (
              orderIds.map((oId) => {
                const thread = chats[oId]!;
                const isSelected = selectedOrderId === oId;
                const lastMsg = thread.messages[thread.messages.length - 1];

                return (
                  <button
                    key={oId}
                    onClick={() => setSelectedOrderId(oId)}
                    className={`w-full text-left p-4 transition-all relative ${
                      isSelected ? 'bg-white shadow-sm' : 'hover:bg-white/60'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-terracotta rounded-r" />
                    )}
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-extrabold text-charcoal text-sm">{oId}</span>
                      <span className="text-[10px] text-muted font-medium">{thread.deliveryDate}</span>
                    </div>
                    <div className="text-xs font-semibold text-charcoal/90 truncate mb-1">
                      {thread.productName}
                    </div>
                    <div className="text-[11px] text-muted truncate">
                      {lastMsg ? lastMsg.text : `${thread.orderQuantity} &bull; ${thread.quotedPrice}`}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px]">
                      <span className="font-bold text-forest bg-forest/10 px-2 py-0.5 rounded-full">
                        {thread.totalQuote}
                      </span>
                      <span className="text-muted font-medium">{thread.status}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Panel: Active Chat & Negotiation Area (8 cols) */}
        <div className="lg:col-span-8 flex flex-col bg-white">
          {activeChat ? (
            <>
              {/* Chat Thread Header */}
              <div className="p-4 border-b border-muted-border flex items-center justify-between bg-white">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-extrabold text-charcoal">
                      {activeChat.orderId} &mdash; {activeChat.productName}
                    </h2>
                    <span className="text-xs bg-sand/60 text-charcoal font-bold px-2 py-0.5 rounded-full border border-muted-border">
                      {activeChat.orderQuantity}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted mt-1">
                    <span>
                      Quoted: <strong className="text-charcoal font-semibold">{activeChat.quotedPrice}</strong>
                    </span>
                    <span>&bull;</span>
                    <span>
                      Total: <strong className="text-charcoal font-semibold">{activeChat.totalQuote}</strong>
                    </span>
                    <span>&bull;</span>
                    <span>Target Delivery: <strong className="text-charcoal font-semibold">{activeChat.deliveryDate}</strong></span>
                  </div>
                </div>

                <Link
                  to={`/client/orders/${activeChat.orderId}`}
                  className="text-xs font-bold text-terracotta hover:underline flex items-center gap-1"
                >
                  <span>View Order</span>
                  <ArrowRight size={13} />
                </Link>
              </div>

              {/* Chat Messages Stream */}
              <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-ivory/20">
                {isChatLoading && (
                  <div className="flex justify-center py-4">
                    <Loader2 size={20} className="animate-spin text-terracotta" />
                  </div>
                )}

                {messagesToDisplay.map((msg) => {
                  const isUser = msg.sender === 'user';
                  const isAdmin = msg.sender === 'admin';
                  const isAi = msg.sender === 'assistant';

                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-3 max-w-[85%] ${
                        isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
                      }`}
                    >
                      {/* Avatar */}
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-xs ${
                          isUser
                            ? 'bg-terracotta'
                            : isAdmin
                            ? 'bg-forest'
                            : 'bg-charcoal'
                        }`}
                      >
                        {isUser ? <User size={15} /> : isAdmin ? <Building size={15} /> : <Bot size={15} />}
                      </div>

                      {/* Message Bubble */}
                      <div className="space-y-1.5">
                        <div className={`flex items-center gap-2 text-[10px] text-muted ${isUser ? 'justify-end' : ''}`}>
                          <span className="font-bold text-charcoal">{msg.senderName}</span>
                          <span>{msg.time}</span>
                        </div>

                        <div
                          className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                            isUser
                              ? 'bg-terracotta text-white rounded-tr-none shadow-sm'
                              : isAdmin
                              ? 'bg-forest/10 border border-forest/20 text-charcoal rounded-tl-none font-medium'
                              : 'bg-white border border-muted-border text-charcoal rounded-tl-none shadow-sm'
                          }`}
                        >
                          <p className="whitespace-pre-line">{msg.text}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Negotiation Prompts */}
              <div className="px-4 py-2 border-t border-muted-border/60 bg-sand/30 flex items-center gap-2 overflow-x-auto text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted shrink-0">Quick Ask:</span>
                <button
                  type="button"
                  onClick={() => handleQuickPrompt("Can you offer a volume discount if we increase the order quantity by 20%?")}
                  className="px-2.5 py-1 rounded-full bg-white border border-muted-border hover:border-terracotta text-charcoal text-[11px] shrink-0 font-medium transition-all"
                >
                  Volume Discount Inquiry
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPrompt("Could you propose an alternative fabric blend that meets our ₹270/m target rate?")}
                  className="px-2.5 py-1 rounded-full bg-white border border-muted-border hover:border-terracotta text-charcoal text-[11px] shrink-0 font-medium transition-all"
                >
                  Alternative Fabric Specs
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPrompt("What is the earliest delivery date if we confirm quotation today?")}
                  className="px-2.5 py-1 rounded-full bg-white border border-muted-border hover:border-terracotta text-charcoal text-[11px] shrink-0 font-medium transition-all"
                >
                  Earliest Delivery Date
                </button>
              </div>

              {/* Input Bar */}
              <form onSubmit={handleSend} className="p-3 border-t border-muted-border bg-white flex items-center gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Ask a question about yarn counts, delivery date, or propose a target rate..."
                  disabled={isChatSending || isSendingLiveMessage}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-muted-border text-xs text-charcoal focus:outline-none focus:border-terracotta disabled:opacity-60 font-medium bg-ivory/20 focus:bg-white transition-all"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || isChatSending || isSendingLiveMessage}
                  className="px-4 py-2.5 rounded-xl bg-terracotta text-white font-bold text-xs hover:bg-terracotta-dark disabled:opacity-50 transition-all flex items-center gap-1.5 shadow-sm"
                >
                  {isChatSending || isSendingLiveMessage ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                  <span>Send</span>
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted">
              <Bot size={40} className="text-muted/50 mb-3" />
              <h3 className="font-extrabold text-charcoal text-sm">No Conversation Selected</h3>
              <p className="text-xs max-w-sm mt-1">
                Select an order from the active list to negotiate commercial terms with the mill.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
