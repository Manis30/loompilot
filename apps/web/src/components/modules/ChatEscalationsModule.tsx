import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Search,
  Phone,
  MoreVertical,
  Paperclip,
  Mic,
  Send,
  Play,
  Pause,
  CheckCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  X,
  UserCheck,
  Sparkles,
  PhoneCall,
  PhoneOff
} from 'lucide-react';
import type { Order, ChatMessage } from '../../types';

export interface ChatEscalationsModuleProps {
  orders: Order[];
  chatMessages: Record<string, ChatMessage[]>;
  onSendMessage: (orderId: string, content: string) => void;
  onResolveEscalation: (orderId: string, approved: boolean, concessionPercent?: number) => void;
}

// ---------------------------------------------------------------------------
// Rich Chat Models for High-Fidelity Experience
// ---------------------------------------------------------------------------

interface MessageReaction {
  emoji: string;
  count: number;
  userReacted?: boolean;
}

interface RichChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole?: string;
  avatarUrl: string;
  isCurrentUser: boolean;
  timestamp: string;
  text?: string;
  type: 'text' | 'image' | 'voice' | 'system_escalation';
  mediaUrl?: string;
  voiceDuration?: string;
  reactions?: MessageReaction[];
  readStatus?: 'sent' | 'delivered' | 'read';
}

interface ChatContact {
  id: string; // matches order.id or group id
  orderId?: string;
  name: string;
  role: string;
  avatarUrl: string;
  initials: string;
  lastMessageSnippet: string;
  timeAgo: string;
  unreadCount?: number;
  isGroup?: boolean;
  memberCount?: number;
  onlineCount?: number;
  isStarred?: boolean;
  hasDoubleCheck?: boolean;
  isEscalated?: boolean;
}

export const ChatEscalationsModule: React.FC<ChatEscalationsModuleProps> = ({
  orders,
  chatMessages,
  onSendMessage,
  onResolveEscalation
}) => {
  // -------------------------------------------------------------------------
  // State: Active Contact & Message History
  // -------------------------------------------------------------------------
  const [activeContactId, setActiveContactId] = useState<string>('design_chat');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [messageInput, setMessageInput] = useState<string>('');
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  const [audioPlaybackProgress, setAudioPlaybackProgress] = useState<number>(0);
  const [isTakeoverActive, setIsTakeoverActive] = useState<boolean>(true);
  const [isCallModalOpen, setIsCallModalOpen] = useState<boolean>(false);
  const [callDuration, setCallDuration] = useState<number>(0);
  const [inChatSearchOpen, setInChatSearchOpen] = useState<boolean>(false);
  const [inChatSearchTerm, setInChatSearchTerm] = useState<string>('');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // -------------------------------------------------------------------------
  // Contacts Directory (Matching Reference Image & Textile Clients)
  // -------------------------------------------------------------------------
  const contacts: ChatContact[] = [
    {
      id: 'design_chat',
      orderId: 'LP-901',
      name: 'Design chat',
      role: 'Floor Masters & Textile Designers',
      avatarUrl: '',
      initials: 'DC',
      lastMessageSnippet: 'Jessie Rollins sent voice message',
      timeAgo: '4h',
      unreadCount: 1,
      isGroup: true,
      memberCount: 23,
      onlineCount: 10,
      isStarred: true
    },
    {
      id: 'osman_campos',
      orderId: 'LP-902',
      name: 'Osman Campos',
      role: 'Urban Textiles • Head Weaver',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      initials: 'OC',
      lastMessageSnippet: 'You: Hey! We are ready to unblock Shed A...',
      timeAgo: '20m',
      hasDoubleCheck: true,
      isStarred: true,
      isEscalated: true
    },
    {
      id: 'jayden_church',
      orderId: 'LP-903',
      name: 'Jayden Church',
      role: 'Style World • Production Lead',
      avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
      initials: 'JC',
      lastMessageSnippet: 'I prepared some yarn count lab dips for you...',
      timeAgo: '1h',
      isStarred: true
    },
    {
      id: 'jacob_mcleod',
      orderId: 'LP-904',
      name: 'Jacob Mcleod',
      role: 'Home Living • Quality Inspector',
      avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
      initials: 'JM',
      lastMessageSnippet: 'And send me the protocol for Airjet #7...',
      timeAgo: '10m',
      unreadCount: 3
    },
    {
      id: 'jasmin_lowery',
      orderId: 'TX-1024',
      name: 'Jasmin Lowery',
      role: 'ABC Garments • Merchandiser',
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      initials: 'JL',
      lastMessageSnippet: "You: Ok! Let's discuss it on the loom floor.",
      timeAgo: '30m',
      hasDoubleCheck: true
    },
    {
      id: 'zaid_myers',
      orderId: 'TX-1025',
      name: 'Zaid Myers',
      role: 'StyleMart • Commercial Buyer',
      avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
      initials: 'ZM',
      lastMessageSnippet: 'You: Concession review submitted to MD...',
      timeAgo: '45m',
      unreadCount: 1,
      isEscalated: true
    },
    {
      id: 'anthony_cardanes',
      orderId: 'TX-1026',
      name: 'Anthony Cardanes',
      role: 'HomeNest • Procurement Manager',
      avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
      initials: 'AC',
      lastMessageSnippet: 'What do you think of the new linen sample?',
      timeAgo: '1d'
    },
    {
      id: 'conner_garcia',
      orderId: 'TX-1027',
      name: 'Conner Garcia',
      role: 'TechCart • Sourcing Officer',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      initials: 'CG',
      lastMessageSnippet: 'You: I think it would be perfect for autumn.',
      timeAgo: '2d',
      hasDoubleCheck: true
    },
    {
      id: 'vanessa_cox',
      orderId: 'TX-1028',
      name: 'Vanessa Cox',
      role: 'KitchenKart • Apparel Sourcing',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      initials: 'VC',
      lastMessageSnippet: 'Voice message (0:22)',
      timeAgo: '2d',
      hasDoubleCheck: true
    }
  ];

  // Filtered contacts based on search
  const filteredContacts = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.lastMessageSnippet.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeContact = contacts.find((c) => c.id === activeContactId) || contacts[0];
  const activeOrder = orders.find((o) => o.id === activeContact.orderId) || orders[0];
  const activeEscalation = activeOrder?.discountEscalation;

  // -------------------------------------------------------------------------
  // Messages Feed (LoomPilot Forest Green & Crisp White Theme)
  // -------------------------------------------------------------------------
  const [messagesByContact, setMessagesByContact] = useState<Record<string, RichChatMessage[]>>({
    design_chat: [
      {
        id: 'msg_dc_1',
        senderId: 'jasmin_lowery',
        senderName: 'Jasmin Lowery',
        avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
        isCurrentUser: false,
        timestamp: '09:20',
        type: 'text',
        text: 'I added new flows to our design system. Now you can use them for your projects!',
        reactions: [{ emoji: '👍', count: 5, userReacted: true }],
        readStatus: 'read'
      },
      {
        id: 'msg_dc_2',
        senderId: 'alex_hunt',
        senderName: 'Alex Hunt',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        isCurrentUser: false,
        timestamp: '09:24',
        type: 'text',
        text: 'Hey guys! Important news!',
        readStatus: 'read'
      },
      {
        id: 'msg_dc_3',
        senderId: 'alex_hunt',
        senderName: 'Alex Hunt',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        isCurrentUser: false,
        timestamp: '09:24',
        type: 'text',
        text: 'Our intern @jchurch has successfully completed his probationary period and is now part of our team!',
        reactions: [
          { emoji: '🔥', count: 5, userReacted: false },
          { emoji: '👍', count: 4, userReacted: true }
        ],
        readStatus: 'read'
      },
      {
        id: 'msg_dc_4',
        senderId: 'admin_john',
        senderName: 'John Doe (MD)',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        isCurrentUser: true,
        timestamp: '09:27',
        type: 'text',
        text: 'Jaden, my congratulations! I will be glad to work with you on a new project 🤗',
        readStatus: 'read'
      },
      {
        id: 'msg_dc_5',
        senderId: 'alex_hunt',
        senderName: 'Alex Hunt',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        isCurrentUser: false,
        timestamp: '09:30',
        type: 'image',
        mediaUrl: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&auto=format&fit=crop&q=80',
        readStatus: 'read'
      },
      {
        id: 'msg_dc_6',
        senderId: 'jessie_rollins',
        senderName: 'Jessie Rollins',
        avatarUrl: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=150&auto=format&fit=crop&q=80',
        isCurrentUser: false,
        timestamp: '09:30',
        type: 'voice',
        voiceDuration: '0:14',
        readStatus: 'read'
      }
    ]
  });

  // Current contact messages (merging external chatMessages prop if present)
  const propMessages = (activeContact.orderId && chatMessages[activeContact.orderId]) || [];
  const activeMessages = useMemo(() => {
    if (messagesByContact[activeContactId]) {
      return messagesByContact[activeContactId];
    }
    if (propMessages.length > 0) {
      return propMessages.map((m) => ({
        id: m.id,
        senderId: m.sender === 'admin' ? 'admin_john' : activeContact.id,
        senderName: m.senderName,
        avatarUrl:
          m.sender === 'admin'
            ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
            : activeContact.avatarUrl,
        isCurrentUser: m.sender === 'admin',
        timestamp: m.timestamp,
        type: 'text' as const,
        text: m.content,
        readStatus: 'read' as const
      }));
    }
    return [
      {
        id: `msg_fallback_1`,
        senderId: activeContact.id,
        senderName: activeContact.name,
        avatarUrl: activeContact.avatarUrl,
        isCurrentUser: false,
        timestamp: '10:15',
        type: 'text' as const,
        text: activeContact.lastMessageSnippet.replace(/^You:\s*/, ''),
        readStatus: 'read' as const
      }
    ];
  }, [messagesByContact, activeContactId, propMessages, activeContact]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages.length, activeContactId]);

  // Simulated Call Timer
  useEffect(() => {
    let timer: number;
    if (isCallModalOpen) {
      timer = window.setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(timer);
  }, [isCallModalOpen]);

  // Audio Playback simulation
  useEffect(() => {
    let progressInterval: number;
    if (isAudioPlaying) {
      progressInterval = window.setInterval(() => {
        setAudioPlaybackProgress((prev) => {
          if (prev >= 100) {
            setIsAudioPlaying(false);
            return 0;
          }
          return prev + 5;
        });
      }, 350);
    }
    return () => clearInterval(progressInterval);
  }, [isAudioPlaying]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim()) return;

    const newMsg: RichChatMessage = {
      id: `msg_${Date.now()}`,
      senderId: 'admin_john',
      senderName: 'John Doe (MD)',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      isCurrentUser: true,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'text',
      text: messageInput.trim(),
      readStatus: 'sent'
    };

    setMessagesByContact((prev) => ({
      ...prev,
      [activeContactId]: [...(prev[activeContactId] || activeMessages), newMsg]
    }));

    if (activeContact.orderId) {
      onSendMessage(activeContact.orderId, messageInput.trim());
    }

    setMessageInput('');
  };

  const handleSendVoiceNote = () => {
    const voiceMsg: RichChatMessage = {
      id: `msg_voice_${Date.now()}`,
      senderId: 'admin_john',
      senderName: 'John Doe (MD)',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      isCurrentUser: true,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'voice',
      voiceDuration: '0:18',
      readStatus: 'delivered'
    };

    setMessagesByContact((prev) => ({
      ...prev,
      [activeContactId]: [...(prev[activeContactId] || activeMessages), voiceMsg]
    }));
  };

  const handleSendAttachment = () => {
    const imgMsg: RichChatMessage = {
      id: `msg_img_${Date.now()}`,
      senderId: 'admin_john',
      senderName: 'John Doe (MD)',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      isCurrentUser: true,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'image',
      mediaUrl: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80',
      readStatus: 'delivered'
    };

    setMessagesByContact((prev) => ({
      ...prev,
      [activeContactId]: [...(prev[activeContactId] || activeMessages), imgMsg]
    }));
  };

  const handleToggleReaction = (msgId: string, emoji: string) => {
    setMessagesByContact((prev) => {
      const currentList = prev[activeContactId] || activeMessages;
      return {
        ...prev,
        [activeContactId]: currentList.map((m) => {
          if (m.id !== msgId) return m;
          const existingReactions = m.reactions || [];
          const matched = existingReactions.find((r) => r.emoji === emoji);

          if (matched) {
            return {
              ...m,
              reactions: existingReactions.map((r) =>
                r.emoji === emoji
                  ? {
                      ...r,
                      count: r.userReacted ? r.count - 1 : r.count + 1,
                      userReacted: !r.userReacted
                    }
                  : r
              )
            };
          } else {
            return {
              ...m,
              reactions: [...existingReactions, { emoji, count: 1, userReacted: true }]
            };
          }
        })
      };
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // -------------------------------------------------------------------------
  // RENDER COMPONENT
  // -------------------------------------------------------------------------
  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        maxHeight: '100%',
        overflow: 'hidden',
        background: '#ffffff',
        borderRadius: 20,
        border: '1px solid #edf2ee',
        boxSizing: 'border-box',
        fontFamily: 'inherit'
      }}
    >
      {/* ===================================================================
          LEFT PANEL: CLIENT & TEAM CONVERSATIONS LIST
          =================================================================== */}
      <div
        style={{
          width: 320,
          borderRight: '1px solid #edf2ee',
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          flexShrink: 0
        }}
      >
        {/* Search Header Container (Donezo Mint Pill) */}
        <div style={{ padding: '16px 16px 12px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              background: '#F8F0DF',
              borderRadius: 14,
              padding: '9px 12px',
              border: '1px solid #edf2ee'
            }}
          >
            <Search size={16} color="#18191B" strokeWidth={2.3} />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 13,
                color: '#111827',
                width: '100%'
              }}
            />
          </div>
        </div>

        {/* Contacts Stream */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0 8px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 2
          }}
        >
          {filteredContacts.map((contact) => {
            const isSelected = contact.id === activeContactId;

            return (
              <div
                key={contact.id}
                onClick={() => setActiveContactId(contact.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '9px 10px',
                  borderRadius: 14,
                  cursor: 'pointer',
                  background: isSelected ? '#F8F0DF' : 'transparent',
                  border: isSelected ? '1px solid #edf2ee' : '1px solid transparent',
                  transition: 'all 0.15s ease'
                }}
              >
                {/* Squircle Avatar (Forest Green Monogram) */}
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 13,
                    background: contact.avatarUrl ? 'transparent' : '#222C2E',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    flexShrink: 0,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                  }}
                >
                  {contact.avatarUrl ? (
                    <img
                      src={contact.avatarUrl}
                      alt={contact.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <span style={{ color: '#ffffff', fontWeight: 800, fontSize: 14, letterSpacing: '-0.3px' }}>
                      {contact.initials}
                    </span>
                  )}
                </div>

                {/* Contact Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: isSelected ? '#18191B' : '#111827',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {contact.name}
                    </span>
                    <span style={{ fontSize: 10, color: '#64748b', marginLeft: 4 }}>
                      {contact.timeAgo}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: 2
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        color: isSelected ? '#18191B' : '#64748b',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: 160
                      }}
                    >
                      {contact.lastMessageSnippet}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {/* Unread Counter Badge (Terracotta / Coral) */}
                      {contact.unreadCount && (
                        <span
                          style={{
                            background: '#df5538',
                            color: '#ffffff',
                            fontSize: 9.5,
                            fontWeight: 800,
                            minWidth: 16,
                            height: 16,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0 4px'
                          }}
                        >
                          {contact.unreadCount}
                        </span>
                      )}

                      {/* Sparkle / Read Checkmark (Forest Green #C32B37) */}
                      {contact.isStarred ? (
                        <Sparkles size={12} color="#18191B" fill="#79B4B7" />
                      ) : contact.hasDoubleCheck ? (
                        <CheckCheck size={13} color="#18191B" strokeWidth={2.5} />
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===================================================================
          RIGHT PANEL: ACTIVE CHAT CONVERSATION WINDOW
          =================================================================== */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          position: 'relative',
          minWidth: 0
        }}
      >
        {/* Chat Window Header */}
        <div
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid #edf2ee',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#ffffff'
          }}
        >
          {/* Title & Online Count */}
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                color: '#111827',
                letterSpacing: '-0.3px'
              }}
            >
              {activeContact.name}
            </h2>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              {activeContact.isGroup
                ? `${activeContact.memberCount} members, ${activeContact.onlineCount} online`
                : `${activeContact.role} • Active now`}
            </div>
          </div>

          {/* Action Icons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Takeover Mode Indicator (Forest Green Mint Pill) */}
            <button
              onClick={() => setIsTakeoverActive(!isTakeoverActive)}
              style={{
                background: isTakeoverActive ? '#F8F0DF' : '#f1f5f9',
                border: isTakeoverActive ? '1px solid #edf2ee' : '1px solid #e2e8f0',
                borderRadius: 20,
                padding: '4px 10px',
                fontSize: 10.5,
                fontWeight: 700,
                color: isTakeoverActive ? '#18191B' : '#64748b',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                cursor: 'pointer'
              }}
            >
              <UserCheck size={12} />
              <span>{isTakeoverActive ? 'Admin Takeover' : 'AI Handling'}</span>
            </button>

            {/* In-chat search button */}
            <button
              onClick={() => setInChatSearchOpen(!inChatSearchOpen)}
              title="Search conversation"
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: 4
              }}
            >
              <Search size={18} strokeWidth={2} />
            </button>

            {/* Audio Call button */}
            <button
              onClick={() => setIsCallModalOpen(true)}
              title="Call client"
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: 4
              }}
            >
              <Phone size={18} strokeWidth={2} />
            </button>

            {/* More Options */}
            <button
              title="Options"
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: 4
              }}
            >
              <MoreVertical size={18} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Optional In-Chat Search Bar */}
        {inChatSearchOpen && (
          <div
            style={{
              padding: '6px 20px',
              background: '#f8faf9',
              borderBottom: '1px solid #edf2ee',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <Search size={14} color="#64748b" />
            <input
              type="text"
              placeholder="Search messages in this thread..."
              value={inChatSearchTerm}
              onChange={(e) => setInChatSearchTerm(e.target.value)}
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: 11,
                color: '#111827'
              }}
            />
            <button
              onClick={() => {
                setInChatSearchTerm('');
                setInChatSearchOpen(false);
              }}
              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Discount Concession Escalation Banner (If active for this client) */}
        {activeEscalation && activeEscalation.status === 'open' && (
          <div
            style={{
              margin: '10px 20px 0',
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: 14,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: '#f59e0b',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <ShieldAlert size={16} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e' }}>
                  Commercial Escalation &bull; {activeContact.name} ({activeContact.orderId})
                </div>
                <div style={{ fontSize: 10.5, color: '#b45309', marginTop: 1 }}>
                  Client requested <strong>{activeEscalation.requestedDiscountPercent}% discount</strong> (${activeEscalation.requestedPrice}/m). Leaves healthy 15.2% margin.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() =>
                  onResolveEscalation(
                    activeContact.orderId || '',
                    true,
                    activeEscalation.requestedDiscountPercent
                  )
                }
                style={{
                  background: '#79B4B7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '5px 12px',
                  fontSize: 10.5,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer'
                }}
              >
                <CheckCircle2 size={13} />
                Approve {activeEscalation.requestedDiscountPercent}%
              </button>
              <button
                onClick={() => onResolveEscalation(activeContact.orderId || '', false)}
                style={{
                  background: '#ffffff',
                  color: '#64748b',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  padding: '5px 12px',
                  fontSize: 10.5,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer'
                }}
              >
                <XCircle size={13} />
                Decline
              </button>
            </div>
          </div>
        )}

        {/* ===================================================================
            MESSAGE FEED (Forest Green & Mint Crisp Theme)
            =================================================================== */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14
          }}
        >
          {activeMessages
            .filter((m: RichChatMessage) =>
              inChatSearchTerm
                ? (m.text || '').toLowerCase().includes(inChatSearchTerm.toLowerCase())
                : true
            )
            .map((msg: RichChatMessage) => {
              const isMe = msg.isCurrentUser;

              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: 10,
                    alignSelf: isMe ? 'flex-end' : 'flex-start',
                    maxWidth: '75%'
                  }}
                >
                  {/* Left Avatar for Incoming Messages */}
                  {!isMe && (
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 12,
                        background: msg.avatarUrl ? 'transparent' : '#222C2E',
                        overflow: 'hidden',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                      }}
                    >
                      {msg.avatarUrl ? (
                        <img
                          src={msg.avatarUrl}
                          alt={msg.senderName}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <span style={{ color: '#ffffff', fontSize: 12, fontWeight: 700 }}>
                          {msg.senderName.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Message Bubble Container */}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div
                      style={{
                        background: isMe ? 'linear-gradient(135deg, #2D393B 0%, #1D2628 100%)' : '#FEFBF3',
                        color: isMe ? '#ffffff' : '#111827',
                        borderRadius: 16,
                        borderBottomRightRadius: isMe ? 4 : 16,
                        borderBottomLeftRadius: isMe ? 16 : 4,
                        border: isMe ? 'none' : '1px solid #e2ede6',
                        padding: msg.type === 'image' ? 4 : '10px 14px',
                        boxShadow: isMe ? '0 2px 8px rgba(22, 78, 50, 0.2)' : '0 1px 2px rgba(0,0,0,0.02)',
                        position: 'relative'
                      }}
                    >
                      {/* Sender Name on top of incoming bubble */}
                      {!isMe && (
                        <div
                          style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            color: '#18191B',
                            marginBottom: 3
                          }}
                        >
                          {msg.senderName}
                        </div>
                      )}

                      {/* TEXT MESSAGE CONTENT */}
                      {msg.type === 'text' && (
                        <div
                          style={{
                            fontSize: 12.5,
                            lineHeight: 1.45,
                            wordBreak: 'break-word',
                            fontWeight: 400
                          }}
                        >
                          {msg.text}
                        </div>
                      )}

                      {/* MEDIA / IMAGE MESSAGE */}
                      {msg.type === 'image' && (
                        <div
                          onClick={() => setLightboxImage(msg.mediaUrl || null)}
                          style={{
                            borderRadius: 12,
                            overflow: 'hidden',
                            position: 'relative',
                            cursor: 'pointer'
                          }}
                        >
                          <img
                            src={msg.mediaUrl}
                            alt="Attached file"
                            style={{
                              width: '100%',
                              maxHeight: 220,
                              objectFit: 'cover',
                              display: 'block',
                              borderRadius: 12
                            }}
                          />
                          <div
                            style={{
                              position: 'absolute',
                              bottom: 6,
                              right: 8,
                              background: 'rgba(0,0,0,0.45)',
                              color: '#ffffff',
                              padding: '2px 6px',
                              borderRadius: 4,
                              fontSize: 9.5,
                              fontWeight: 600
                            }}
                          >
                            {msg.timestamp}
                          </div>
                        </div>
                      )}

                      {/* VOICE AUDIO MESSAGE */}
                      {msg.type === 'voice' && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '4px 2px'
                          }}
                        >
                          {/* Play/Pause Button (Forest Green Circle) */}
                          <button
                            onClick={() => setIsAudioPlaying(!isAudioPlaying)}
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              background: isMe ? '#79B4B7' : '#1A1B1D',
                              color: isMe ? '#18191B' : '#ffffff',
                              border: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              flexShrink: 0
                            }}
                          >
                            {isAudioPlaying ? (
                              <Pause size={14} fill="currentColor" />
                            ) : (
                              <Play size={14} fill="currentColor" style={{ marginLeft: 2 }} />
                            )}
                          </button>

                          {/* Animated Waveform Visualization (Forest Green + Mint) */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 24, flex: 1 }}>
                            {[10, 16, 22, 14, 8, 18, 24, 16, 12, 20, 14, 8, 16, 22, 10, 18, 14, 8, 20, 12, 16, 22, 14].map(
                              (height, i) => {
                                const isPlayed = i * 4.3 <= audioPlaybackProgress;
                                return (
                                  <div
                                    key={i}
                                    style={{
                                      width: 2.5,
                                      height: height,
                                      borderRadius: 1,
                                      background: isMe
                                        ? '#ffffff'
                                        : isPlayed
                                        ? '#18191B'
                                        : '#edf2ee',
                                      opacity: isMe && !isPlayed ? 0.45 : 1,
                                      transition: 'background 0.1s ease'
                                    }}
                                  />
                                );
                              }
                            )}
                          </div>

                          {/* Duration Readout */}
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 600,
                              color: isMe ? '#F8F0DF' : '#18191B',
                              minWidth: 26,
                              textAlign: 'right'
                            }}
                          >
                            {msg.voiceDuration || '0:14'}
                          </span>
                        </div>
                      )}

                      {/* Timestamp & Double Checkmarks (Inside Bubble Bottom-Right) */}
                      {msg.type !== 'image' && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: 4,
                            marginTop: 4,
                            fontSize: 9.5,
                            color: isMe ? '#F8F0DF' : '#64748b'
                          }}
                        >
                          <span>{msg.timestamp}</span>
                          {isMe && <CheckCheck size={12} strokeWidth={2.5} color="#ffffff" />}
                        </div>
                      )}
                    </div>

                    {/* Reactions Pill (Mint Background #F8F0DF) */}
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          marginTop: 3,
                          alignSelf: isMe ? 'flex-end' : 'flex-start'
                        }}
                      >
                        {msg.reactions.map((reaction: MessageReaction) => (
                          <button
                            key={reaction.emoji}
                            onClick={() => handleToggleReaction(msg.id, reaction.emoji)}
                            style={{
                              background: reaction.userReacted ? '#F8F0DF' : '#f8faf9',
                              border: reaction.userReacted ? '1px solid #edf2ee' : '1px solid #edf2ee',
                              borderRadius: 12,
                              padding: '2px 6px',
                              fontSize: 10,
                              fontWeight: 600,
                              color: '#111827',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 3,
                              cursor: 'pointer',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                            }}
                          >
                            <span>{reaction.emoji}</span>
                            <span style={{ fontSize: 9.5, color: '#18191B', fontWeight: 700 }}>{reaction.count}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right Avatar for Current User Outgoing Messages */}
                  {isMe && (
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 12,
                        background: '#79B4B7',
                        overflow: 'hidden',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                      }}
                    >
                      <img
                        src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
                        alt="John Doe"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          <div ref={messagesEndRef} />
        </div>

        {/* ===================================================================
            BOTTOM MESSAGE COMPOSER BAR (Forest Green Theme)
            =================================================================== */}
        <div style={{ padding: '12px 24px 16px', background: '#ffffff' }}>
          <form
            onSubmit={handleSendMessage}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: '#F8F0DF',
              borderRadius: 16,
              padding: '6px 10px 6px 14px',
              border: '1px solid #edf2ee'
            }}
          >
            {/* Attachment Paperclip Button */}
            <button
              type="button"
              onClick={handleSendAttachment}
              title="Attach fabric swatch or photo"
              style={{
                background: 'none',
                border: 'none',
                color: '#18191B',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 4
              }}
            >
              <Paperclip size={18} strokeWidth={2.2} />
            </button>

            {/* Main Text Input */}
            <input
              type="text"
              placeholder="Your message..."
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: 13,
                color: '#111827'
              }}
            />

            {/* Voice Recording Button */}
            <button
              type="button"
              onClick={handleSendVoiceNote}
              title="Send audio note"
              style={{
                background: 'none',
                border: 'none',
                color: '#18191B',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 4
              }}
            >
              <Mic size={18} strokeWidth={2.2} />
            </button>

            {/* Send Paper Plane Button (Forest Green Circle #C32B37) */}
            <button
              type="submit"
              disabled={!messageInput.trim()}
              title="Send message"
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: messageInput.trim() ? '#79B4B7' : '#E6DFD5',
                color: '#18191B',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: messageInput.trim() ? 'pointer' : 'default',
                transition: 'background 0.15s ease',
                boxShadow: messageInput.trim() ? '0 2px 6px rgba(22, 78, 50, 0.25)' : 'none'
              }}
            >
              <Send size={15} strokeWidth={2.2} style={{ marginLeft: 1 }} />
            </button>
          </form>
        </div>
      </div>

      {/* ===================================================================
          MODAL: EXECUTIVE AUDIO CALL SIMULATION
          =================================================================== */}
      {isCallModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20
          }}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #1A1B1D 0%, #282A2D 100%)',
              borderRadius: 20,
              width: '100%',
              maxWidth: 360,
              padding: 28,
              color: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}
          >
            {/* Avatar Pulse */}
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: 24,
                background: '#79B4B7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
                boxShadow: '0 0 0 10px rgba(34, 197, 94, 0.2)'
              }}
            >
              {activeContact.avatarUrl ? (
                <img
                  src={activeContact.avatarUrl}
                  alt={activeContact.name}
                  style={{ width: '100%', height: '100%', borderRadius: 24, objectFit: 'cover' }}
                />
              ) : (
                <span style={{ fontSize: 26, fontWeight: 800 }}>{activeContact.initials}</span>
              )}
            </div>

            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{activeContact.name}</h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#edf2ee' }}>{activeContact.role}</p>

            <div
              style={{
                marginTop: 20,
                fontSize: 13,
                color: '#4ade80',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <PhoneCall size={14} />
              <span>Call in progress • {formatDuration(callDuration)}</span>
            </div>

            {/* Audio Wave Sim */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 28, margin: '20px 0' }}>
              {[12, 24, 18, 30, 16, 22, 28, 14, 26, 18, 30, 20].map((h, i) => (
                <div
                  key={i}
                  style={{
                    width: 3,
                    height: h,
                    background: '#22c55e',
                    borderRadius: 2
                  }}
                />
              ))}
            </div>

            {/* End Call Button */}
            <button
              onClick={() => setIsCallModalOpen(false)}
              style={{
                background: '#ef4444',
                color: '#ffffff',
                border: 'none',
                borderRadius: 30,
                padding: '10px 24px',
                fontSize: 12,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)'
              }}
            >
              <PhoneOff size={16} />
              <span>End Call</span>
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================
          MODAL: IMAGE LIGHTBOX PREVIEW
          =================================================================== */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            cursor: 'zoom-out'
          }}
        >
          <img
            src={lightboxImage}
            alt="Preview"
            style={{
              maxWidth: '90%',
              maxHeight: '90%',
              borderRadius: 16,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
            }}
          />
        </div>
      )}
    </div>
  );
};

export default ChatEscalationsModule;
