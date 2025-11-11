import React from 'react';

type ServerStatusType = 'checking' | 'connected' | 'error';

export const ServerStatus: React.FC = () => {
    const [status, setStatus] = React.useState<ServerStatusType>('checking');

    React.useEffect(() => {
        const checkStatus = async () => {
            try {
                const response = await fetch('http://127.0.0.1:8000/api/status');
                if (response.ok) {
                    setStatus('connected');
                } else {
                    setStatus('error');
                }
            } catch (error) {
                setStatus('error');
            }
        };

        // Initial check
        checkStatus();

        // Check every 30 seconds
        const interval = setInterval(checkStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    const getStatusColor = () => {
        switch (status) {
            case 'connected':
                return 'bg-green-500';
            case 'error':
                return 'bg-red-500';
            default:
                return 'bg-yellow-500';
        }
    };

    return (
        <div className="fixed bottom-4 right-4 flex items-center bg-gray-800 px-3 py-2 rounded-lg shadow-lg">
            <div className={`w-3 h-3 rounded-full mr-2 ${getStatusColor()}`} />
            <span className="text-sm">
                {status === 'connected' ? 'Backend Connected' : 
                 status === 'error' ? 'Backend Error' : 
                 'Checking Connection...'}
            </span>
        </div>
    );
};