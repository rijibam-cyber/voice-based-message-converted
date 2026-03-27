/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Mic, Square, Loader2, Copy, Check, Trash2, Volume2, Sparkles, MessageSquare, X, Send, User, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { cn } from './lib/utils';

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface Message {
  role: 'user' | 'model';
  text: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'converter' | 'chat'>('converter');
  
  // Converter State
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [styledText, setStyledText] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState('Direct');

  // Chat State
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Hello! I am your VoxConvert assistant. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const styles = ['Direct', 'Professional', 'Poetic', 'Concise', 'Pirate'];

  // Converter Logic
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setError(null);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Microphone access denied. Please check your permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (blob: Blob) => {
    setIsProcessing(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [
            {
              parts: [
                { inlineData: { data: base64Data, mimeType: 'audio/webm' } },
                { text: `Transcribe this audio accurately. If the audio is empty or unclear, say "No clear audio detected."` }
              ]
            }
          ]
        });

        const text = response.text || '';
        setTranscription(text);
        if (text && text !== "No clear audio detected.") {
          await applyStyle(text, selectedStyle);
        }
        setIsProcessing(false);
      };
    } catch (err) {
      console.error('Error processing audio:', err);
      setError('Failed to process audio. Please try again.');
      setIsProcessing(false);
    }
  };

  const applyStyle = async (text: string, style: string) => {
    if (!text || style === 'Direct') {
      setStyledText(text);
      return;
    }

    setIsProcessing(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Rewrite the following text in a ${style} style: "${text}"`,
      });
      setStyledText(response.text || text);
    } catch (err) {
      console.error('Error applying style:', err);
      setStyledText(text);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (transcription && selectedStyle) {
      applyStyle(transcription, selectedStyle);
    }
  }, [selectedStyle]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(styledText || transcription);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clear = () => {
    setTranscription('');
    setStyledText('');
    setError(null);
  };

  // Chat Logic
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsTyping(true);

    try {
      const chat = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: "You are a helpful FAQ assistant for VoxConvert. VoxConvert is a voice-to-text application that transcribes audio and allows users to rewrite it in different styles (Professional, Poetic, Concise, Pirate). Answer questions about the app, how to use it, and general queries politely and concisely.",
        },
      });

      // Simple history mapping
      const history = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          ...history,
          { role: 'user', parts: [{ text: userMessage }] }
        ],
        config: {
          systemInstruction: "You are a helpful FAQ assistant for VoxConvert. VoxConvert is a voice-to-text application that transcribes audio and allows users to rewrite it in different styles (Professional, Poetic, Concise, Pirate). Answer questions about the app, how to use it, and general queries politely and concisely.",
        }
      });

      setMessages(prev => [...prev, { role: 'model', text: response.text || 'Sorry, I encountered an error.' }]);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, { role: 'model', text: 'I am having trouble connecting right now. Please try again later.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-6 overflow-hidden">
      {/* Immersive Background */}
      <div className="absolute inset-0 atmosphere pointer-events-none" />
      
      <main className="relative z-10 w-full max-w-2xl flex flex-col gap-8">
        <header className="text-center space-y-4">
          <div className="space-y-2">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-5xl font-serif italic tracking-tight text-white/90"
            >
              VoxConvert
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-sm uppercase tracking-[0.2em] text-white/40 font-medium"
            >
              Voice to Styled Text
            </motion.p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex justify-center gap-4">
            <button
              onClick={() => setActiveTab('converter')}
              className={cn(
                "px-6 py-2 rounded-full text-xs font-bold tracking-widest uppercase transition-all border",
                activeTab === 'converter' 
                  ? "bg-white text-black border-white" 
                  : "bg-white/5 text-white/40 border-white/5 hover:border-white/20"
              )}
            >
              Converter
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={cn(
                "px-6 py-2 rounded-full text-xs font-bold tracking-widest uppercase transition-all border",
                activeTab === 'chat' 
                  ? "bg-white text-black border-white" 
                  : "bg-white/5 text-white/40 border-white/5 hover:border-white/20"
              )}
            >
              Assistant
            </button>
          </div>
        </header>

        <section className="glass rounded-[2.5rem] p-8 space-y-8 shadow-2xl min-h-[500px] flex flex-col">
          <AnimatePresence mode="wait">
            {activeTab === 'converter' ? (
              <motion.div
                key="converter"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex-1 flex flex-col"
              >
                <div className="flex flex-col items-center justify-center gap-6 py-8">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={isProcessing}
                    className={cn(
                      "w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 relative",
                      isRecording ? "bg-red-500 shadow-[0_0_40px_rgba(239,68,68,0.4)]" : "bg-white/10 hover:bg-white/20",
                      isProcessing && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {isRecording ? (
                      <Square className="w-8 h-8 text-white fill-white" />
                    ) : isProcessing ? (
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                    ) : (
                      <Mic className="w-8 h-8 text-white" />
                    )}
                    
                    {isRecording && (
                      <motion.div
                        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="absolute inset-0 rounded-full border-2 border-red-500"
                      />
                    )}
                  </motion.button>
                  
                  <div className="text-center">
                    <p className="text-lg font-medium text-white/80">
                      {isRecording ? "Listening..." : isProcessing ? "Processing..." : "Tap to speak"}
                    </p>
                    {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
                  </div>
                </div>

                <AnimatePresence>
                  {(transcription || isProcessing) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-6"
                    >
                      <div className="h-px bg-white/10" />
                      
                      <div className="flex flex-wrap gap-2 justify-center">
                        {styles.map((style) => (
                          <button
                            key={style}
                            onClick={() => setSelectedStyle(style)}
                            className={cn(
                              "px-4 py-1.5 rounded-full text-xs font-medium transition-all border",
                              selectedStyle === style 
                                ? "bg-white text-black border-white" 
                                : "bg-transparent text-white/60 border-white/10 hover:border-white/30"
                            )}
                          >
                            {style}
                          </button>
                        ))}
                      </div>

                      <div className="relative group">
                        <div className="min-h-[120px] p-6 rounded-2xl bg-white/5 border border-white/5 text-white/90 font-serif text-xl leading-relaxed italic">
                          {isProcessing && !styledText ? (
                            <div className="flex items-center gap-2 text-white/40">
                              <Sparkles className="w-4 h-4 animate-pulse" />
                              <span>Gemini is thinking...</span>
                            </div>
                          ) : (
                            styledText || transcription
                          )}
                        </div>
                        
                        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={copyToClipboard}
                            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                            title="Copy"
                          >
                            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                          </button>
                          <button 
                            onClick={clear}
                            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-red-400"
                            title="Clear"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ) : (
              <motion.div
                key="chat"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col h-full"
              >
                <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar max-h-[400px]">
                  {messages.map((m, i) => (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={i}
                      className={cn(
                        "flex gap-3 max-w-[85%]",
                        m.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                        m.role === 'user' ? "bg-white/10" : "bg-accent/20 border border-accent/30"
                      )}>
                        {m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4 text-accent" />}
                      </div>
                      <div className={cn(
                        "p-4 rounded-2xl text-sm leading-relaxed",
                        m.role === 'user' 
                          ? "bg-white/10 text-white/90 rounded-tr-none" 
                          : "bg-white/5 text-white/80 rounded-tl-none border border-white/5"
                      )}>
                        <div className="markdown-body">
                          <ReactMarkdown>{m.text}</ReactMarkdown>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  {isTyping && (
                    <div className="flex gap-3 max-w-[85%] mr-auto">
                      <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center shrink-0">
                        <Bot className="w-4 h-4 text-accent" />
                      </div>
                      <div className="p-4 rounded-2xl bg-white/5 text-white/40 rounded-tl-none border border-white/5 flex gap-1">
                        <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1 }}>.</motion.span>
                        <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}>.</motion.span>
                        <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}>.</motion.span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <form onSubmit={handleSendMessage} className="mt-6 relative">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask me anything about VoxConvert..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-6 pr-14 text-sm focus:outline-none focus:border-white/30 transition-all placeholder:text-white/20"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isTyping}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-white text-black disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <footer className="flex justify-center gap-8 text-[10px] uppercase tracking-widest text-white/20 font-bold">
          <div className="flex items-center gap-2">
            <Volume2 className="w-3 h-3" />
            <span>High Fidelity</span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-3 h-3" />
            <span>AI Powered</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
