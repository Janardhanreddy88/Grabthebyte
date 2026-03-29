import React from 'react';
import { ChevronLeft, MessageCircle, PhoneCall } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function HelpSupport() {
  const navigate = useNavigate();
  
  // 🌟 DUMMY NUMBER FOR NOW - WE UPDATE THIS LATER 🌟
  const supportNumber = "917993792683"; 
  const defaultMessage = "Hi GrabTheByte Support! I need some help with my canteen order.";

  const openWhatsApp = () => {
    const encodedMessage = encodeURIComponent(defaultMessage);
    const whatsappUrl = `https://wa.me/${supportNumber}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="bg-white p-4 shadow-sm flex items-center sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="mr-4 p-1 rounded-full hover:bg-gray-100 transition-colors">
          <ChevronLeft size={24} className="text-gray-800" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Help & Support</h1>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 p-6 flex flex-col items-center justify-center text-center">
        
        {/* Support Icon Graphic */}
        <div className="bg-red-100 p-6 rounded-full mb-6 shadow-inner">
          <PhoneCall size={48} className="text-red-600" />
        </div>
        
        <h2 className="text-2xl font-bold text-gray-800 mb-3">How can we help you?</h2>
        <p className="text-gray-500 mb-10 max-w-xs leading-relaxed">
          Having an issue with your payment or canteen order? Drop us a message on WhatsApp and our team will fix it instantly.
        </p>

        {/* The Big WhatsApp Action Button */}
        <button 
          onClick={openWhatsApp}
          className="w-full max-w-sm bg-[#25D366] text-white font-bold text-lg py-4 rounded-2xl shadow-lg shadow-[#25D366]/30 flex items-center justify-center space-x-3 hover:bg-[#20bd5a] active:scale-95 transition-all duration-200"
        >
          <MessageCircle size={28} />
          <span>Chat on WhatsApp</span>
        </button>
        
        {/* Support Hours Text */}
        <p className="mt-8 text-sm font-medium text-gray-400 bg-gray-200 py-1.5 px-4 rounded-full">
          Support Hours: 9:00 AM - 4:00 PM
        </p>
      </div>
    </div>
  );
}