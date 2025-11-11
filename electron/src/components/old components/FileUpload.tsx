import React from 'react';
import { FileUploadProps } from '../types';

export const FileUpload: React.FC<FileUploadProps> = ({ files, onUpload, onRemove }) => {
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.length) {
            onUpload(Array.from(e.target.files));
        }
    };

    return (
        <div className="flex flex-wrap gap-2">
            {files.map((file, index) => (
                <div key={index} className="file-badge bg-gray-700 text-white px-3 py-1 rounded-full text-sm flex items-center">
                    <span className="truncate max-w-xs">{file.name}</span>
                    <button
                        onClick={() => onRemove(index)}
                        className="ml-2 text-gray-400 hover:text-red-400"
                    >
                        <i data-feather="x" className="w-4 h-4" />
                    </button>
                </div>
            ))}
            <button
                onClick={() => fileInputRef.current?.click()}
                className="text-gray-400 hover:text-blue-400 transition"
            >
                <i data-feather="paperclip" />
                <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    multiple
                    onChange={handleFileSelect}
                />
            </button>
        </div>
    );
};