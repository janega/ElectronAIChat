import React from 'react';
import { Message as MessageType } from '../types';

export const Message: React.FC<MessageType> = ({ text, sender }) => (
    <div className={`flex ${sender === 'user' ? 'justify-end' : 'justify-start'}`}>
        <div className={`message-bubble p-4 rounded-lg ${
            sender === 'user' ? 'bg-blue-500 rounded-tr-none' : 'bg-gray-700 rounded-tl-none'
        }`}>
            <p>{text}</p>
        </div>
    </div>
);