import React from 'react';
import { usePodcast } from '../context/PodcastContext';

export const ChatHistory = () => {
    const { conversation, currentIndex } = usePodcast();

    const cleanMessage = (message) => {
        return message
            .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
            .replace(/\[(.*?)\]/g, '') // Remove text inside square brackets
            .replace(/\((.*?)\)/g, '') // Remove text inside parentheses
            .replace(/^(Host|Guest):\s*/i, '') // Remove speaker prefixes
            .trim();
    };

    return (
        <div className="fixed bottom-6 right-[-8%] transform -translate-x-1/2 w-full max-w-sm 
                bg-black/30 backdrop-blur-md p-5 rounded-xl shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="space-y-4">
                {conversation.map((message, index) => (
                    <div key={index} className="text-white">
                        <strong className='text-xl'>{message.speaker}:</strong> {cleanMessage(message.message)}
                    </div>
                ))}
            </div>
        </div>
    );
};