import React, { useState } from 'react';
import { User } from 'lucide-react';

interface UsernameModalProps {
  onUsernameSet: (username: string) => void;
  isLoading?: boolean;
}

export const UsernameModal: React.FC<UsernameModalProps> = ({ 
  onUsernameSet, 
  isLoading = false 
}) => {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  const validateUsername = (value: string): string => {
    if (!value.trim()) {
      return 'Username is required';
    }
    if (value.length > 50) {
      return 'Username must be 50 characters or less';
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
      return 'Username can only contain letters, numbers, hyphens, and underscores';
    }
    return '';
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUsername(value);
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateUsername(username);
    if (validationError) {
      setError(validationError);
      return;
    }
    onUsernameSet(username.trim());
  };

  const isValid = username.trim() && !validateUsername(username);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
        <div className="flex items-center justify-center mb-6">
          <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-full">
            <User size={32} className="text-blue-600 dark:text-blue-400" />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-center mb-2 text-gray-900 dark:text-gray-100">
          Welcome to ElectronAIChat
        </h2>
        
        <p className="text-center text-gray-600 dark:text-gray-400 mb-6">
          Enter a username to get started
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label 
              htmlFor="username" 
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={handleChange}
              placeholder="john_doe"
              disabled={isLoading}
              autoFocus
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent
                bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                ${error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}
                ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            />
            {error && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Letters, numbers, hyphens, and underscores only (max 50 characters)
            </p>
          </div>

          <button
            type="submit"
            disabled={!isValid || isLoading}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-colors
              ${isValid && !isLoading
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              }
            `}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Initializing...
              </span>
            ) : (
              'Continue'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
