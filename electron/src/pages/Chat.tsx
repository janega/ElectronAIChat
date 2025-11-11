import React from "react";
import { Message } from "../components/Message";
import { FileUpload } from "../components/FileUpload";
import { ServerStatus } from "../components/ServerStatus";
import { Message as MessageType } from "../types";
import { MessageCircle, Send } from "react-feather";

const API_URL = import.meta.env.VITE_API_URL;


const Chat: React.FC = () => {
  const [messages, setMessages] = React.useState<MessageType[]>([
    {
      text: "Hello! I'm your AI assistant powered by Ollama. How can I help you today?",
      sender: "ai",
    },
  ]);
  const [inputValue, setInputValue] = React.useState<string>("");
  const [files, setFiles] = React.useState<File[]>([]);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (inputValue.trim()) {
      setMessages([...messages, { text: inputValue, sender: "user" }]);
      setInputValue("");
        try {
            const response = await fetch(`/api/documents/chat`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    query: inputValue,
                    key_prefixes: files.map((file) => file.name) || null,
                    top_k: 5
                }),
            });

            if (!response.ok) {
                throw new Error("Network response was not ok");
            }

            const data = await response.json();
            setMessages(prev => [...prev, { 
                text: data.answer,
                sender: "ai",
                context: data.context // Optional: You can use this to display sources
            }]);
        } catch (error) {
            console.error("Error:", error);
            setMessages(prev => [...prev, { 
                text: "Sorry, I encountered an error processing your request.",
                sender: "ai" 
            }]);
        }
      }
    };


  const handleFileUpload = (newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
      {/* Header */}
      <header className="bg-gray-800 p-4 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-400 flex items-center">
            <MessageCircle className="mr-2" />
            Ollama Chat
          </h1>
          <button
            onClick={() => window.electron.openConfig()}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center transition"
          >
            Settings
          </button>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-hidden container mx-auto p-4">
        <div className="chat-container overflow-y-auto mb-4 space-y-4">
          {messages.map((msg, index) => (
            <Message key={index} {...msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Context Files Section */}
      {/* <div className="bg-gray-800 p-4 border-t border-gray-700">
                <div className="container mx-auto">
                    <h3 className="text-sm font-semibold text-gray-400 mb-2">CONTEXT FILES</h3>
                    <FileUpload files={files} onUpload={handleFileUpload} onRemove={removeFile} />
                </div>
            </div> */}

      {/* Input Area */}
      <div className="bg-gray-800 p-4 border-t border-gray-700">
        <div className="px-[50px] w-full">
          <div className="bg-gray-700 rounded-2xl p-2 flex items-end w-full">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="flex-1 bg-transparent text-white px-4 py-2 focus:outline-none resize-none w-full"
              rows={1}
              placeholder="Type your message here..."
              style={{ minHeight: "44px", maxHeight: "120px", resize: "none" }}
              onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <button
              onClick={handleSendMessage}
              className="p-2 rounded-xl hover:bg-gray-600 transition-colors duration-200 flex items-center justify-center"
            >
              <Send size={20} className="text-gray-300" />
            </button>
          </div>
        </div>
      </div>

      {/* Server Status */}
      <ServerStatus />
    </div>
  );
};

export default Chat;
