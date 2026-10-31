import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Sparkles,
  Send,
  RotateCcw,
  Minimize2,
  X,
  ArrowRight
} from 'lucide-react';
import type { Order, AdminNavTab } from '../../types';

export interface FloatingAIChatbotProps {
  orders: Order[];
  onNavigateTab: (tab: AdminNavTab) => void;
  onSelectOrder?: (orderId: string) => void;
}

interface AIChatbotMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
  actionButton?: {
    label: string;
    targetTab: AdminNavTab;
  };
  highlightData?: {
    label: string;
    value: string;
  };
}

export const FloatingAIChatbot: React.FC<FloatingAIChatbotProps> = ({
  orders: _orders,
  onNavigateTab,
  onSelectOrder: _onSelectOrder
}) => {
  const [isChatbotOpen, setIsChatbotOpen] = useState<boolean>(false);
  const [isChatbotMinimized, setIsChatbotMinimized] = useState<boolean>(false);
  const [chatbotInput, setChatbotInput] = useState<string>('');
  const [isAITyping, setIsAITyping] = useState<boolean>(false);
  const chatbotMessagesEndRef = useRef<HTMLDivElement | null>(null);

  const [chatbotMessages, setChatbotMessages] = useState<AIChatbotMessage[]>([
    {
      id: 'msg_welcome',
      sender: 'ai',
      text: "Hello Managing Director John! I am your LoomPilot AI Copilot, synchronized live across all 48 looms, active orders, and procurement pipelines. How can I assist your operations today?",
      timestamp: 'Just now',
      actionButton: {
        label: 'View Urgent Approvals (5)',
        targetTab: 'quotations'
      }
    }
  ]);

  // Auto-scroll AI chatbot feed
  useEffect(() => {
    if (isChatbotOpen && !isChatbotMinimized) {
      chatbotMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatbotMessages.length, isChatbotOpen, isChatbotMinimized, isAITyping]);

  const handleSendChatbotMessage = (queryText: string) => {
    const text = queryText.trim();
    if (!text) return;

    const userMsg: AIChatbotMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatbotMessages((prev) => [...prev, userMsg]);
    setChatbotInput('');
    setIsAITyping(true);

    setTimeout(() => {
      setIsAITyping(false);
      const lower = text.toLowerCase();
      let aiReply: AIChatbotMessage;

      if (lower.includes('lp-902') || lower.includes('urban') || lower.includes('delay') || lower.includes('shortage')) {
        aiReply = {
          id: `ai_${Date.now()}`,
          sender: 'ai',
          text: "Order LP-902 (Urban Textiles, 8,000m Cotton Shirts) is facing a 4-day projected delay. Bottleneck: 600m raw fabric shortage awaiting PO-1001 supplier delivery from Sri Textiles. Weaving paced at 35% below target on Loom #3.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          highlightData: { label: 'Shortage', value: '600m Cotton Fabric' },
          actionButton: { label: 'Inspect PO-1002 in Procurement', targetTab: 'procurement' }
        };
      } else if (lower.includes('loom') || lower.includes('mch') || lower.includes('breakdown') || lower.includes('sensor')) {
        aiReply = {
          id: `ai_${Date.now()}`,
          sender: 'ai',
          text: "Loom #7 (Picanol OmniPlus-i Airjet) in Shed A is logged in Breakdown status due to a warp tension sensor malfunction at 14:15. Floor Master Ramesh Kumar is overseeing recalibration. Target completion: 15:30. Order LP-904 batch can shift to Loom #12 if necessary.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          highlightData: { label: 'Loom #7 Status', value: 'Recalibrating (ETA 45m)' },
          actionButton: { label: 'Manage Looms in Supervisors', targetTab: 'supervisors' }
        };
      } else if (lower.includes('approval') || lower.includes('pending') || lower.includes('quote') || lower.includes('decision')) {
        aiReply = {
          id: `ai_${Date.now()}`,
          sender: 'ai',
          text: "You currently have 5 urgent items requiring Managing Director approval: 1) QT-1001 for ABC Garments (₹3.50L @ 18% margin), 2) PO-1002 Cotton Fabric clearance, 3) StyleMart -5% discount concession, 4) PR-108 yarn surge revision, and 5) Loom #7 reallocation.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          highlightData: { label: 'Pending Approvals', value: '5 Urgent Items' },
          actionButton: { label: 'Review Quotations', targetTab: 'quotations' }
        };
      } else if (lower.includes('capacity') || lower.includes('new order') || lower.includes('5000') || lower.includes('feasible')) {
        aiReply = {
          id: `ai_${Date.now()}`,
          sender: 'ai',
          text: "Current daily factory pace is 2,350m / 2,780m (84.5% capacity). Shed B has 430m daily reserve capacity available. We can accept an urgent 5,000m weaving run if scheduled starting next Monday across Looms #15–#18.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          highlightData: { label: 'Reserve Capacity', value: '430 m/day' },
          actionButton: { label: 'Check Order Pipeline', targetTab: 'orders' }
        };
      } else if (lower.includes('profit') || lower.includes('revenue') || lower.includes('margin') || lower.includes('financial')) {
        aiReply = {
          id: `ai_${Date.now()}`,
          sender: 'ai',
          text: "Current active pipeline projected revenue stands at ₹48.60L with an estimated gross profit of ₹11.20L (23.0% margin). Historical on-time delivery dispatch rate is 94.6% across 48 completed lots.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          highlightData: { label: 'Projected Profit', value: '₹11.20L (23.0%)' },
          actionButton: { label: 'View Price Centre', targetTab: 'priceCentre' }
        };
      } else {
        aiReply = {
          id: `ai_${Date.now()}`,
          sender: 'ai',
          text: `Analyzing mill telemetry for "${text}"... All 48 looms are reporting nominal speed (850 RPM average), with 44/45 weavers on shift. What specific order, loom, or procurement action would you like me to execute?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
      }

      setChatbotMessages((prev) => [...prev, aiReply]);
    }, 600);
  };

  return (
    <>
      {/* ===================================================================
          CIRCULAR FLOATING AI CHATBOT BUTTON (Bottom-Right Corner)
          =================================================================== */}
      <button
        onClick={() => {
          setIsChatbotOpen(!isChatbotOpen);
          setIsChatbotMinimized(false);
        }}
        title={isChatbotOpen ? "Close AI Copilot" : "Open LoomPilot AI Mill Copilot"}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 28,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #242120 0%, #151312 100%)',
          color: '#ffffff',
          border: '2px solid #79B4B7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 28px rgba(27, 25, 24, 0.5)',
          cursor: 'pointer',
          zIndex: 9999,
          transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease',
          outline: 'none'
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        {isChatbotOpen ? (
          <X size={22} color="#ffffff" strokeWidth={2.5} />
        ) : (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bot size={25} color="#79B4B7" strokeWidth={2.2} />
            <span
              style={{
                position: 'absolute',
                top: -3,
                right: -4,
                width: 9,
                height: 9,
                borderRadius: '50%',
                background: '#79B4B7',
                border: '2px solid #1B1918',
                boxShadow: '0 0 8px #79B4B7'
              }}
            />
          </div>
        )}
      </button>

      {/* ===================================================================
          INTERACTIVE AI CHATBOT WINDOW (Anchored in Bottom-Right Corner)
          =================================================================== */}
      {isChatbotOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: isChatbotMinimized ? 88 : 92,
            right: 28,
            width: isChatbotMinimized ? 300 : 385,
            height: isChatbotMinimized ? 48 : 500,
            background: '#ffffff',
            borderRadius: 16,
            border: '1px solid #edf2ee',
            boxShadow: '0 12px 36px rgba(19, 68, 46, 0.25)',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            transition: 'height 0.2s ease, width 0.2s ease',
            fontFamily: 'inherit'
          }}
        >
          {/* AI Header */}
          <div
            style={{
              background: 'linear-gradient(135deg, #242120 0%, #151312 100%)',
              color: '#ffffff',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer'
            }}
            onClick={() => setIsChatbotMinimized(!isChatbotMinimized)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  background: 'rgba(255, 255, 255, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative'
                }}
              >
                <Bot size={15} color="#79B4B7" />
                <span
                  style={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: '#79B4B7'
                  }}
                />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.2px' }}>
                  LoomPilot AI Copilot
                </div>
                <div style={{ fontSize: 9.5, color: '#79B4B7', opacity: 0.9 }}>
                  Live Telemetry &bull; 5 Agents Active
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setChatbotMessages([
                    {
                      id: 'msg_welcome',
                      sender: 'ai',
                      text: "Chat cleared. I am your LoomPilot AI Copilot, ready to assist with factory operations and approvals.",
                      timestamp: 'Just now'
                    }
                  ]);
                }}
                title="Reset conversation"
                style={{ background: 'none', border: 'none', color: '#79B4B7', cursor: 'pointer', padding: 2 }}
              >
                <RotateCcw size={13} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsChatbotMinimized(!isChatbotMinimized);
                }}
                title={isChatbotMinimized ? 'Expand' : 'Minimize'}
                style={{ background: 'none', border: 'none', color: '#79B4B7', cursor: 'pointer', padding: 2 }}
              >
                <Minimize2 size={13} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsChatbotOpen(false);
                }}
                title="Close AI Chatbot"
                style={{ background: 'none', border: 'none', color: '#79B4B7', cursor: 'pointer', padding: 2 }}
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {!isChatbotMinimized && (
            <>
              {/* Message Feed */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  background: '#FAF4EA'
                }}
              >
                {chatbotMessages.map((msg) => {
                  const isUser = msg.sender === 'user';
                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignSelf: isUser ? 'flex-end' : 'flex-start',
                        maxWidth: '85%'
                      }}
                    >
                      <div
                        style={{
                          background: isUser ? '#222C2E' : '#FEFBF3',
                          color: isUser ? '#ffffff' : '#1B1918',
                          borderRadius: 14,
                          borderBottomRightRadius: isUser ? 2 : 14,
                          borderBottomLeftRadius: isUser ? 14 : 2,
                          border: isUser ? 'none' : '1px solid #E8DEC8',
                          padding: '9px 12px',
                          fontSize: 11.5,
                          lineHeight: 1.45,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                        }}
                      >
                        <div>{msg.text}</div>

                        {/* Highlight metric card if returned by AI */}
                        {msg.highlightData && (
                          <div
                            style={{
                              marginTop: 6,
                              background: '#FAF4EA',
                              border: '1px solid #79B4B7',
                              borderRadius: 6,
                              padding: '4px 8px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontSize: 10
                            }}
                          >
                            <span style={{ color: '#4A4543', fontWeight: 600 }}>{msg.highlightData.label}</span>
                            <span style={{ color: '#79B4B7', fontWeight: 800 }}>{msg.highlightData.value}</span>
                          </div>
                        )}

                        {/* Action link if returned by AI */}
                        {msg.actionButton && (
                          <button
                            onClick={() => {
                              onNavigateTab(msg.actionButton!.targetTab);
                              setIsChatbotMinimized(true);
                            }}
                            style={{
                              marginTop: 7,
                              background: '#79B4B7',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: 6,
                              padding: '4px 10px',
                              fontSize: 10,
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              cursor: 'pointer'
                            }}
                          >
                            <span>{msg.actionButton.label}</span>
                            <ArrowRight size={10} />
                          </button>
                        )}

                        <div
                          style={{
                            fontSize: 9,
                            color: isUser ? '#FAF4EA' : '#8C827A',
                            marginTop: 3,
                            textAlign: 'right'
                          }}
                        >
                          {msg.timestamp}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {isAITyping && (
                  <div
                    style={{
                      alignSelf: 'flex-start',
                      background: '#ffffff',
                      border: '1px solid #E8DEC8',
                      borderRadius: 12,
                      padding: '6px 12px',
                      fontSize: 10,
                      color: '#18191B',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <Sparkles size={11} color="#79B4B7" />
                    <span>AI Copilot analyzing factory telemetry...</span>
                  </div>
                )}
                <div ref={chatbotMessagesEndRef} />
              </div>

              {/* Quick Suggestion Chips */}
              <div
                style={{
                  padding: '6px 10px',
                  background: '#ffffff',
                  borderTop: '1px solid #edf2ee',
                  display: 'flex',
                  gap: 5,
                  overflowX: 'auto',
                  whiteSpace: 'nowrap'
                }}
              >
                {[
                  'Why is LP-902 delayed?',
                  'Loom #7 breakdown',
                  'Pending approvals',
                  'Check 5,000m capacity'
                ].map((chip) => (
                  <button
                    key={chip}
                    onClick={() => handleSendChatbotMessage(chip)}
                    style={{
                      background: '#edf7ef',
                      border: '1px solid #c9eed1',
                      borderRadius: 9999,
                      padding: '3px 8px',
                      fontSize: 9.5,
                      fontWeight: 600,
                      color: '#18191B',
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Bottom Input Composer */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendChatbotMessage(chatbotInput);
                }}
                style={{
                  padding: '8px 12px 10px',
                  background: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  borderTop: '1px solid #edf2ee'
                }}
              >
                <input
                  type="text"
                  placeholder="Ask AI about orders, looms, materials..."
                  value={chatbotInput}
                  onChange={(e) => setChatbotInput(e.target.value)}
                  style={{
                    flex: 1,
                    background: '#FAF4EA',
                    border: '1px solid #E8DEC8',
                    borderRadius: 8,
                    padding: '6px 10px',
                    fontSize: 11,
                    color: '#1B1918',
                    outline: 'none'
                  }}
                />
                <button
                  type="submit"
                  disabled={!chatbotInput.trim()}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: chatbotInput.trim() ? '#79B4B7' : '#cbd5e1',
                    color: '#18191B',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: chatbotInput.trim() ? 'pointer' : 'default'
                  }}
                >
                  <Send size={13} />
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
};

export default FloatingAIChatbot;

