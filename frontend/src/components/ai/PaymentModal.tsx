import React, { useState } from 'react';
import { X, CreditCard, Check, Loader2 } from 'lucide-react';

interface PaymentPackage {
  id: string;
  messages: number;
  price: number;
  popular?: boolean;
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: (messages: number) => void;
}

const paymentPackages: PaymentPackage[] = [
  { id: '30_messages', messages: 30, price: 20 },
  { id: '50_messages', messages: 50, price: 30, popular: true },
  { id: '100_messages', messages: 100, price: 50 }
];

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  onPaymentSuccess
}) => {
  const [selectedPackage, setSelectedPackage] = useState<PaymentPackage | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'select' | 'payment' | 'success'>('select');

  const handlePackageSelect = (pkg: PaymentPackage) => {
    setSelectedPackage(pkg);
    setPaymentStep('payment');
  };

  const handleMockPayment = async () => {
    if (!selectedPackage) return;

    setIsProcessing(true);
    
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mock 90% success rate
    const isSuccess = Math.random() > 0.1;
    
    if (isSuccess) {
      setPaymentStep('success');
      setTimeout(() => {
        onPaymentSuccess(selectedPackage.messages);
        handleClose();
      }, 1500);
    } else {
      alert('Payment failed. Please try again.');
      setPaymentStep('select');
    }
    
    setIsProcessing(false);
  };

  const handleClose = () => {
    setSelectedPackage(null);
    setPaymentStep('select');
    setIsProcessing(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {paymentStep === 'select' && 'Choose Your Package'}
            {paymentStep === 'payment' && 'Payment Details'}
            {paymentStep === 'success' && 'Payment Successful!'}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isProcessing}
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {paymentStep === 'select' && (
            <div className="space-y-4">
              <p className="text-gray-600 text-center mb-6">
                You've used all your free messages. Choose a package to continue using the AI Content Generator.
              </p>
              
              {paymentPackages.map((pkg) => (
                <div
                  key={pkg.id}
                  className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
                    pkg.popular 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handlePackageSelect(pkg)}
                >
                  {pkg.popular && (
                    <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                      <span className="bg-blue-500 text-white text-xs px-3 py-1 rounded-full">
                        Most Popular
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg text-gray-900">
                        {pkg.messages} Messages
                      </h3>
                      <p className="text-gray-600 text-sm">
                        RM {pkg.price.toFixed(2)} per {pkg.messages} messages
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">
                        RM {pkg.price}
                      </div>
                      <div className="text-sm text-gray-500">
                        RM {(pkg.price / pkg.messages).toFixed(2)} per message
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {paymentStep === 'payment' && selectedPackage && (
            <div className="space-y-6">
              {/* Package Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Order Summary</h3>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">{selectedPackage.messages} Messages</span>
                  <span className="font-semibold">RM {selectedPackage.price.toFixed(2)}</span>
                </div>
              </div>

              {/* Mock Payment Form */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <CreditCard size={20} />
                  Payment Information
                </h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Card Number
                    </label>
                    <input
                      type="text"
                      placeholder="1234 5678 9012 3456"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isProcessing}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Expiry Date
                      </label>
                      <input
                        type="text"
                        placeholder="MM/YY"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isProcessing}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        CVV
                      </label>
                      <input
                        type="text"
                        placeholder="123"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isProcessing}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Button */}
              <button
                onClick={handleMockPayment}
                disabled={isProcessing}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Processing Payment...
                  </>
                ) : (
                  <>
                    <CreditCard size={20} />
                    Pay RM {selectedPackage.price.toFixed(2)}
                  </>
                )}
              </button>

              {/* Back Button */}
              <button
                onClick={() => setPaymentStep('select')}
                disabled={isProcessing}
                className="w-full text-gray-600 hover:text-gray-800 font-medium py-2 transition-colors"
              >
                ← Back to Packages
              </button>
            </div>
          )}

          {paymentStep === 'success' && selectedPackage && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Check size={32} className="text-green-600" />
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Payment Successful!
                </h3>
                <p className="text-gray-600">
                  {selectedPackage.messages} messages have been added to your account.
                </p>
              </div>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800 font-medium">
                  You can now continue using the AI Content Generator!
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};