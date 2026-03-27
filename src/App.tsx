/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Mic, Square, Loader2, Copy, Check, Trash2, Volume2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [styledText, setStyledText] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState('Direct');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const styles = ['Direct', 'Professional', 'Poetic', 'Concise', 'Pirate'];

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

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-6 overflow-hidden">
      {/* Immersive Background */}
      <div className="absolute inset-0 atmosphere pointer-events-none" />
      
      <main className="relative z-10 w-full max-w-2xl flex flex-col gap-8">
        <header className="text-center space-y-2">
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
        </header>

        <section className="glass rounded-[2.5rem] p-8 space-y-8 shadow-2xl">
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
