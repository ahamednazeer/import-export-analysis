'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Robot, X, PaperPlaneTilt, Trash, ChatCircleDots, Sparkle, ArrowRight } from '@phosphor-icons/react';
import { api } from '@/lib/api';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface ActionChip {
    label: string;
    url: string;
}

interface AIAssistantProps {
    userRole?: string;
}

const roleColors: Record<string, { primary: string; bg: string; border: string }> = {
    DEALER: { primary: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
    WAREHOUSE_OPERATOR: { primary: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' },
    PROCUREMENT_MANAGER: { primary: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
    LOGISTICS_PLANNER: { primary: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
    ADMIN: { primary: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
};

// Format message with markdown-like styling and action chips
const formatMessage = (content: string, isAssistant: boolean, onNavigate: (url: string) => void) => {
    if (!isAssistant) {
        return <span className="whitespace-pre-wrap">{content}</span>;
    }

    // Extract Action Chips: <<Label|URL>>
    const actions: ActionChip[] = [];
    const cleanContent = content.replace(/<<([^|]+)\|([^>]+)>>/g, (match, label, url) => {
        actions.push({ label, url });
        return ''; // Remove from text
    }).trim();

    // Split into lines and process each
    const lines = cleanContent.split('\n');
    const elements: React.ReactNode[] = [];
    let listItems: React.ReactNode[] = [];
    let listType: 'bullet' | 'number' | null = null;

    const flushList = () => {
        if (listItems.length > 0) {
            if (listType === 'number') {
                elements.push(
                    <ol key={`ol-${elements.length}`} className="list-decimal list-inside space-y-1 my-2 ml-1">
                        {listItems}
                    </ol>
                );
            } else {
                elements.push(
                    <ul key={`ul-${elements.length}`} className="space-y-1 my-2 ml-1">
                        {listItems}
                    </ul>
                );
            }
            listItems = [];
            listType = null;
        }
    };

    const formatInlineText = (text: string, key: string) => {
        // Handle **bold** text
        const parts = text.split(/(\*\*[^*]+\*\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={`${key}-${i}`} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
            }
            return <span key={`${key}-${i}`}>{part}</span>;
        });
    };

    lines.forEach((line, idx) => {
        const trimmed = line.trim();

        // Check for bullet points (•, -, *)
        const bulletMatch = trimmed.match(/^[•\-\*]\s+(.+)$/);
        if (bulletMatch) {
            if (listType !== 'bullet') {
                flushList();
                listType = 'bullet';
            }
            listItems.push(
                <li key={`li-${idx}`} className="flex items-start gap-2">
                    <span className="text-slate-400 mt-0.5">•</span>
                    <span>{formatInlineText(bulletMatch[1], `b-${idx}`)}</span>
                </li>
            );
            return;
        }

        // Check for numbered lists (1. 2. 3.)
        const numberMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
        if (numberMatch) {
            if (listType !== 'number') {
                flushList();
                listType = 'number';
            }
            listItems.push(
                <li key={`li-${idx}`} className="text-slate-200">
                    {formatInlineText(numberMatch[2], `n-${idx}`)}
                </li>
            );
            return;
        }

        // Flush any pending list
        flushList();

        // Empty line = paragraph break
        if (trimmed === '') {
            elements.push(<div key={`br-${idx}`} className="h-2" />);
            return;
        }

        // Regular paragraph
        elements.push(
            <p key={`p-${idx}`} className="text-slate-200 leading-relaxed">
                {formatInlineText(line, `p-${idx}`)}
            </p>
        );
    });

    // Flush any remaining list
    flushList();

    return (
        <div className="space-y-3">
            <div className="space-y-1">{elements}</div>

            {actions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3 pt-2 border-t border-white/10">
                    {actions.map((action, idx) => (
                        <button
                            key={idx}
                            onClick={() => onNavigate(action.url)}
                            className="group flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-full text-sm transition-all hover:pr-4"
                        >
                            <Sparkle className="w-4 h-4 text-yellow-400" />
                            <span>{action.label}</span>
                            <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 -ml-2 group-hover:ml-0 transition-all" />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default function AIAssistant({ userRole = 'DEALER' }: AIAssistantProps) {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const colors = roleColors[userRole] || roleColors.DEALER;

    const handleNavigate = (url: string) => {
        setIsOpen(false); // Close chat on navigation
        router.push(url);
    };

    // Load history and welcome message on first open
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            loadHistoryAndWelcome();
        }
    }, [isOpen]);

    // Scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Focus input when opening
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const loadHistoryAndWelcome = async () => {
        try {
            setIsLoading(true);

            // Try to load history first
            try {
                const historyData = await api.getAssistantHistory();
                if (historyData.history && historyData.history.length > 0) {
                    const formattedHistory: Message[] = historyData.history.map((msg: any) => ({
                        id: crypto.randomUUID(),
                        role: msg.role,
                        content: msg.content,
                        timestamp: new Date() // Ideally backend returns timestamp
                    }));
                    setMessages(formattedHistory);

                    // If we have history, just load suggestions without welcome message
                    const welcomeData = await api.getAssistantWelcome();
                    if (welcomeData.suggestions) {
                        setSuggestions(welcomeData.suggestions);
                    }
                } else {
                    // No history, load welcome message
                    await loadWelcome();
                }
            } catch (err) {
                // Fallback to welcome if history fails
                await loadWelcome();
            }
        } catch (error) {
            console.error('Failed to load assistant data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadWelcome = async () => {
        try {
            const data = await api.getAssistantWelcome();
            if (data.message) {
                setMessages([{
                    id: 'welcome',
                    role: 'assistant',
                    content: data.message,
                    timestamp: new Date()
                }]);
            }
            if (data.suggestions) {
                setSuggestions(data.suggestions);
            }
        } catch (error) {
            console.error('Failed to load welcome:', error);
            setMessages([{
                id: 'welcome',
                role: 'assistant',
                content: "Hello! I'm your AI assistant. How can I help you today?",
                timestamp: new Date()
            }]);
        }
    };

    const sendMessage = async (text?: string) => {
        const messageText = text || input.trim();
        if (!messageText || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: messageText,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setSuggestions([]);
        setIsLoading(true);

        try {
            const data = await api.chatWithAssistant(messageText);

            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: data.response,
                timestamp: new Date()
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Chat error:', error);
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: "I'm sorry, I couldn't process that request. Please try again.",
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const clearChat = async () => {
        try {
            await api.clearAssistantHistory();
        } catch (error) {
            console.error('Failed to clear history:', error);
        }
        setMessages([]);
        setSuggestions([]);
        loadWelcome();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <>
            {/* Chat Widget Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg transition-all duration-300 flex items-center justify-center ${isOpen ? 'bg-slate-700' : `bg-gradient-to-br from-slate-800 to-slate-900 ${colors.border} border-2`
                    } hover:scale-110`}
                title="AI Assistant"
            >
                {isOpen ? (
                    <X size={24} className="text-white" />
                ) : (
                    <Robot size={28} weight="duotone" className={colors.primary} />
                )}
            </button>

            {/* Chat Panel */}
            {isOpen && (
                <div className="fixed bottom-24 right-6 z-50 w-96 h-[500px] bg-slate-900 border border-slate-700 rounded-lg shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                    {/* Header */}
                    <div className={`px-4 py-3 border-b border-slate-700 ${colors.bg} flex items-center justify-between`}>
                        <div className="flex items-center gap-2">
                            <Robot size={20} weight="duotone" className={colors.primary} />
                            <div>
                                <h3 className="font-semibold text-sm text-white">AI Assistant</h3>
                                <p className={`text-xs ${colors.primary} font-mono`}>
                                    {userRole.replace(/_/g, ' ')} Mode
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={clearChat}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                            title="Clear conversation"
                        >
                            <Trash size={18} />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[80%] px-3 py-2 rounded-lg ${msg.role === 'user'
                                        ? `${colors.bg} ${colors.border} border text-white`
                                        : 'bg-slate-800 text-slate-200'
                                        }`}
                                >
                                    {msg.role === 'assistant' && (
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <Sparkle size={12} className={colors.primary} />
                                            <span className={`text-xs ${colors.primary} font-mono`}>AI</span>
                                        </div>
                                    )}
                                    <div className="text-sm ai-message">
                                        {formatMessage(msg.content, msg.role === 'assistant', handleNavigate)}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-slate-800 px-4 py-3 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Suggestions */}
                    {suggestions.length > 0 && (
                        <div className="px-4 pb-2 flex flex-wrap gap-2">
                            {suggestions.map((suggestion, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => sendMessage(suggestion)}
                                    className={`text-xs px-3 py-1.5 rounded-full border ${colors.border} ${colors.bg} ${colors.primary} hover:opacity-80 transition-opacity`}
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Input */}
                    <div className="p-3 border-t border-slate-700 bg-slate-850">
                        <div className="flex items-center gap-2">
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Ask me anything..."
                                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-600"
                                disabled={isLoading}
                            />
                            <button
                                onClick={() => sendMessage()}
                                disabled={!input.trim() || isLoading}
                                className={`p-2 rounded-lg transition-all ${input.trim() && !isLoading
                                    ? `${colors.bg} ${colors.primary} hover:opacity-80`
                                    : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                                    }`}
                            >
                                <PaperPlaneTilt size={20} weight="fill" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
