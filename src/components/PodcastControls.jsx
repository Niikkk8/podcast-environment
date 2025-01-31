import React, { useEffect, useRef, useState } from 'react';
import { usePodcast } from '../context/PodcastContext';
import { useAnimation } from '../context/AnimationContext';
import { ChatHistory } from './ChatHistory';

const INTRO_MESSAGE = "Welcome to our Research Podcast! Today we'll be discussing an exciting paper.";

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
    const speakingRef = useRef(null);
    const voicesLoadedRef = useRef(false);
    const [availableVoices, setAvailableVoices] = useState([]);

    const cleanMessage = (message) => {
        return message
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\[(.*?)\]/g, '')
            .replace(/\(\d{2}:\d{2}:\d{2}\)/g, '')
            .replace(/\(.*?\)/g, '')
            .replace(/^(Host|Guest):\s*/i, '')
            .replace(/^(Host|Guest)\s*/i, '')
            .trim();
    };

    const selectVoice = (isMale) => {
        if (!availableVoices.length) return null;

        const preferredVoices = isMale
            ? ['Google UK English Male', 'Microsoft David', 'Male']
            : ['Google UK English Female', 'Microsoft Zira', 'Female'];

        for (const preferred of preferredVoices) {
            const voice = availableVoices.find(v =>
                v.name.includes(preferred) ||
                v.name.toLowerCase().includes(preferred.toLowerCase())
            );
            if (voice) return voice;
        }

        return availableVoices[0];
    };

    const speakText = async (text, isMale = true) => {
        return new Promise((resolve) => {
            if (speakingRef.current) {
                speechSynthesis.cancel();
            }

            const utterance = new SpeechSynthesisUtterance(text);
            const selectedVoice = selectVoice(isMale);

            if (selectedVoice) {
                utterance.voice = selectedVoice;
            }

            utterance.rate = 1;
            utterance.pitch = isMale ? 0.9 : 1.1;
            utterance.volume = 1.0;

            utterance.onend = () => {
                setIsSpeaking(false);
                resolve();
            };

            utterance.onerror = (event) => {
                console.error('Speech synthesis error:', event);
                setIsSpeaking(false);
                resolve();
            };

            speakingRef.current = utterance;
            setIsSpeaking(true);

            // Split long text into sentences to prevent interruption
            const sentences = text.split(/[.!?]+/).filter(Boolean);
            sentences.forEach((sentence, index) => {
                setTimeout(() => {
                    const utterance = new SpeechSynthesisUtterance(sentence + '.');
                    utterance.voice = selectedVoice;
                    utterance.rate = 1;
                    utterance.pitch = isMale ? 0.9 : 1.1;
                    utterance.volume = 1.0;

                    if (index === sentences.length - 1) {
                        utterance.onend = () => {
                            setIsSpeaking(false);
                            resolve();
                        };
                    }

                    speechSynthesis.speak(utterance);
                }, index * 100);
            });
        });
    };

    const prepareNextLine = async () => {
        if (!isPlaying || isSpeaking) return;

        const nextIndex = currentIndex + 1;

        // Handle initial greeting
        if (currentIndex === -1) {
            setMaleAnimation('Greeting');
            setFemaleAnimation('Greeting');
            await speakText(INTRO_MESSAGE.replace('[TOPIC]', paperDetails.topic), true);
            await new Promise(resolve => setTimeout(resolve, 500));
            setMaleAnimation('Talking');
            setFemaleAnimation('Idle');
            setCurrentIndex(nextIndex);
            const firstMessage = cleanMessage(conversation[0].message);
            await speakText(firstMessage, true);
            setMaleAnimation('Idle');
            return;
        }

        // Set display for next message
        setCurrentIndex(nextIndex);

        // End of conversation
        if (nextIndex >= conversation.length) {
            setIsPlaying(false);
            setMaleAnimation('Idle');
            setFemaleAnimation('Idle');
            return;
        }

        // Regular conversation flow
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

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
            alert('Please upload a PDF file');
            return;
        }

        setIsGenerating(true);
        const formData = new FormData();
        formData.append('pdf', file);

        try {
            const response = await fetch('http://localhost:5000/api/generate-podcast', {
                method: 'POST',
                body: formData,
                signal: AbortSignal.timeout(300000),
            });

            if (!response.ok) {
                throw new Error('Failed to generate podcast');
            }

            const data = await response.json();

            if (!data.conversation || !Array.isArray(data.conversation)) {
                throw new Error('Invalid response format from server');
            }

            setConversation(data.conversation);
            setPaperDetails({
                title: data.title || 'Untitled Paper',
                topic: data.topic || 'General Research'
            });
            setCurrentIndex(-1);
            setIsPlaying(false);
        } catch (error) {
            console.error('Error:', error);
            alert(error.message || 'Error generating podcast. Please try again.');
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
    };

    useEffect(() => {
        const loadVoices = () => {
            const voices = speechSynthesis.getVoices();
            if (voices.length > 0) {
                setAvailableVoices(voices);
                voicesLoadedRef.current = true;
            }
        };

        loadVoices();
        speechSynthesis.onvoiceschanged = loadVoices;

        return () => {
            if (speakingRef.current) {
                speechSynthesis.cancel();
            }
        };
    }, []);

    useEffect(() => {
        if (isPlaying && !isSpeaking && voicesLoadedRef.current) {
            prepareNextLine();
        }
    }, [isPlaying, isSpeaking, currentIndex]);

    return (
        <>
            {/* Minimal controls overlay */}
            <div className="fixed top-4 left-1/2 transform -translate-x-1/2 flex flex-col gap-4 bg-black/20 backdrop-blur-sm p-4 rounded-lg z-10">
                <div className="flex items-center gap-4">
                    {!conversation.length && (
                        <input
                            type="file"
                            accept=".pdf"
                            onChange={handleFileUpload}
                            className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-500 file:text-white hover:file:bg-blue-600 text-white"
                        />
                    )}

                    {conversation.length > 0 && (
                        <div className="flex gap-2">
                            <button
                                onClick={handlePlayPause}
                                className="px-4 py-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                                disabled={isGenerating}
                            >
                                {isPlaying ? 'Pause' : 'Play'}
                            </button>
                            <button
                                onClick={handleReset}
                                className="px-4 py-2 rounded-md bg-gray-500 text-white hover:bg-gray-600 transition-colors"
                                disabled={isGenerating}
                            >
                                Reset
                            </button>
                        </div>
                    )}
                </div>

                {isGenerating && (
                    <div className="text-white animate-pulse">
                        Generating podcast script...
                    </div>
                )}

                {paperDetails.title && (
                    <div className="text-white text-center">
                        <h3 className="font-bold">{paperDetails.title}</h3>
                        <p className="text-sm opacity-75">{paperDetails.topic}</p>
                    </div>
                )}
            </div>

            {/* Chat history component */}
            {conversation.length > 0 && <ChatHistory />}
        </>
    );
};