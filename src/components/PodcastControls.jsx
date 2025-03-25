import React, { useEffect, useRef, useState } from 'react';
import { usePodcast } from '../context/PodcastContext';
import { useAnimation } from '../context/AnimationContext';
import { ChatHistory } from './ChatHistory';

const INTRO_MESSAGE = "Welcome to our Research Podcast! Let's explore this topic together.";

export const PodcastControls = () => {
    const {
        conversation,
        setConversation,
        paperDetails,
        setPaperDetails,
        isGenerating,
        setIsGenerating,
        currentIndex,
        setCurrentIndex,
        isPlaying,
        setIsPlaying,
        isSpeaking,
        setIsSpeaking
    } = usePodcast();

    const { setMaleAnimation, setFemaleAnimation } = useAnimation();
    const [inputText, setInputText] = useState('');
    const [showPreferences, setShowPreferences] = useState(false);
    const [voices, setVoices] = useState([]);
    const currentUtterance = useRef(null);
    
    const [preferences, setPreferences] = useState({
        tone: 'casual',
        detailLevel: 'balanced',
        targetAudience: 'general'
    });

    useEffect(() => {
        // Load available voices
        const loadVoices = () => {
            const availableVoices = speechSynthesis.getVoices();
            setVoices(availableVoices);
        };

        loadVoices();
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = loadVoices;
        }

        return () => {
            if (currentUtterance.current) {
                speechSynthesis.cancel();
            }
        };
    }, []);

    const getVoice = (isMale) => {
        if (!voices.length) return null;
        
        const preferredVoices = isMale 
            ? ['en-GB-Male', 'en-US-Male', 'Google UK English Male', 'Microsoft David']
            : ['en-GB-Female', 'en-US-Female', 'Google UK English Female', 'Microsoft Zira'];

        for (const preferred of preferredVoices) {
            const voice = voices.find(v => v.name.includes(preferred));
            if (voice) return voice;
        }

        return voices[0];
    };

    const cleanMessage = (message) => {
        return message
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\[(.*?)\]/g, '')
            .replace(/\((.*?)\)/g, '')
            .replace(/^(Host|Guest):\s*/i, '')
            .trim();
    };

    const speakText = async (text, isMale = true) => {
        return new Promise((resolve) => {
            if (currentUtterance.current) {
                speechSynthesis.cancel();
            }

            const utterance = new SpeechSynthesisUtterance(text);
            const voice = getVoice(isMale);
            
            if (voice) {
                utterance.voice = voice;
            }
            
            utterance.pitch = isMale ? 0.9 : 1.1;
            utterance.rate = 1;
            utterance.volume = 1;

            utterance.onend = () => {
                setIsSpeaking(false);
                resolve();
            };

            utterance.onerror = () => {
                setIsSpeaking(false);
                resolve();
            };

            currentUtterance.current = utterance;
            setIsSpeaking(true);
            speechSynthesis.speak(utterance);
        });
    };

    const prepareNextLine = async () => {
        if (!isPlaying || isSpeaking) return;

        const nextIndex = currentIndex + 1;

        if (currentIndex === -1) {
            // Only use greeting animation for introduction
            setMaleAnimation('Greeting');
            setFemaleAnimation('Greeting');
            await speakText(INTRO_MESSAGE);
            setMaleAnimation('Idle');
            setFemaleAnimation('Idle');
            setCurrentIndex(nextIndex);
            return;
        }

        setCurrentIndex(nextIndex);

        if (nextIndex >= conversation.length) {
            setIsPlaying(false);
            setMaleAnimation('Idle');
            setFemaleAnimation('Idle');
            return;
        }

        const message = cleanMessage(conversation[nextIndex].message);
        const isHost = conversation[nextIndex].speaker === 'Host';

        try {
            if (isHost) {
                setMaleAnimation('Talking');
                setFemaleAnimation('Idle');
                await speakText(message, true);
                setMaleAnimation('Idle');
            } else {
                setMaleAnimation('Idle');
                setFemaleAnimation('Talking');
                await speakText(message, false);
                setFemaleAnimation('Idle');
            }
        } catch (error) {
            console.error('Speech error:', error);
            setIsSpeaking(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!inputText.trim()) return;

        setIsGenerating(true);
        setShowPreferences(false);

        try {
            const response = await fetch('http://localhost:5000/api/generate-podcast', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: inputText,
                    preferences: preferences
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to generate podcast');
            }

            const data = await response.json();
            setConversation(data.conversation);
            setPaperDetails({
                title: data.title,
                topic: data.topic
            });
            setCurrentIndex(-1);
            setIsPlaying(false);
        } catch (error) {
            console.error('Error:', error);
            alert('Error generating podcast. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handlePlayPause = () => {
        if (conversation.length === 0) return;

        if (currentIndex + 1 >= conversation.length) {
            setCurrentIndex(-1);
        }

        if (isSpeaking) {
            speechSynthesis.cancel();
            setIsSpeaking(false);
        }

        setIsPlaying(!isPlaying);
    };

    const handleReset = () => {
        if (isSpeaking) {
            speechSynthesis.cancel();
            setIsSpeaking(false);
        }
        setCurrentIndex(-1);
        setIsPlaying(false);
        setMaleAnimation('Idle');
        setFemaleAnimation('Idle');
        setInputText('');
    };

    useEffect(() => {
        if (isPlaying && !isSpeaking) {
            prepareNextLine();
        }
    }, [isPlaying, isSpeaking, currentIndex]);

    return (
        <div className="relative min-h-screen flex flex-col items-center px-4">
            <div className="fixed top-6 left-1/2 transform -translate-x-1/2 flex flex-col gap-4 
                          bg-black/30 backdrop-blur-md p-5 rounded-xl shadow-lg z-10 w-full max-w-2xl">
                
                {!conversation.length ? (
                    <form onSubmit={handleSubmit} className="w-full space-y-4">
                        <textarea
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="Enter your topic or text here..."
                            className="w-full h-32 p-3 rounded-lg border border-gray-300 focus:ring-2 
                                     focus:ring-blue-500 focus:border-blue-500"
                        />
                        <div className="flex gap-3">
                            <button
                                type="submit"
                                className="flex-1 bg-blue-600 text-white font-semibold py-2 px-4 
                                         rounded-lg shadow-md hover:bg-blue-700 transition"
                                disabled={isGenerating}
                            >
                                Generate Podcast
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowPreferences(!showPreferences)}
                                className="bg-gray-600 text-white font-semibold py-2 px-4 
                                         rounded-lg shadow-md hover:bg-gray-700 transition"
                            >
                                ⚙️
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="flex gap-3">
                        <button
                            onClick={handlePlayPause}
                            className="px-5 py-2 rounded-lg bg-blue-600 text-white font-semibold 
                                     shadow-md hover:bg-blue-700 transition"
                            disabled={isGenerating}
                        >
                            {isPlaying ? 'Pause' : 'Play'}
                        </button>
                        <button
                            onClick={handleReset}
                            className="px-5 py-2 rounded-lg bg-gray-600 text-white font-semibold 
                                     shadow-md hover:bg-gray-700 transition"
                        >
                            Reset
                        </button>
                    </div>
                )}

                {showPreferences && (
                    <div className="bg-white rounded-lg p-4 space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Conversation Tone
                            </label>
                            <select
                                value={preferences.tone}
                                onChange={(e) => setPreferences({...preferences, tone: e.target.value})}
                                className="w-full border rounded-md p-2"
                            >
                                <option value="casual">Casual & Conversational</option>
                                <option value="professional">Professional</option>
                                <option value="academic">Academic</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Detail Level
                            </label>
                            <select
                                value={preferences.detailLevel}
                                onChange={(e) => setPreferences({...preferences, detailLevel: e.target.value})}
                                className="w-full border rounded-md p-2"
                            >
                                <option value="overview">High-level Overview</option>
                                <option value="balanced">Balanced</option>
                                <option value="detailed">In-depth Details</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Target Audience
                            </label>
                            <select
                                value={preferences.targetAudience}
                                onChange={(e) => setPreferences({...preferences, targetAudience: e.target.value})}
                                className="w-full border rounded-md p-2"
                            >
                                <option value="general">General Public</option>
                                <option value="academic">Academic Researchers</option>
                                <option value="industry">Industry Professionals</option>
                            </select>
                        </div>
                    </div>
                )}

                {isGenerating && (
                    <div className="text-white animate-pulse text-center font-semibold">
                        Generating podcast script...
                    </div>
                )}

                {paperDetails.title && (
                    <div className="text-white text-center">
                        <h3 className="font-bold text-lg">{paperDetails.title}</h3>
                        <p className="text-sm opacity-80">{paperDetails.topic}</p>
                    </div>
                )}
            </div>

            {conversation.length > 0 && <ChatHistory />}
        </div>
    );
};