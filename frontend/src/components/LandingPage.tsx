import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Shield, 
  CreditCard, 
  Wallet, 
  TrendingUp, 
  Globe, 
  Lock,
  ArrowRight,
  CheckCircle,
  Star
} from 'lucide-react';

const LandingPage: React.FC = () => {
  const features = [
    {
      icon: <Wallet className="w-8 h-8 text-blue-600" />,
      title: "Multi-Asset Wallets",
      description: "Secure custodial and non-custodial wallets supporting BTC, ETH, USDT, and more"
    },
    {
      icon: <CreditCard className="w-8 h-8 text-green-600" />,
      title: "Crypto Payment Cards",
      description: "Physical and virtual Visa/Mastercard with instant crypto-to-fiat conversion"
    },
    {
      icon: <TrendingUp className="w-8 h-8 text-purple-600" />,
      title: "DeFi Integration",
      description: "Access to lending, staking, and yield farming protocols like Aave and Compound"
    },
    {
      icon: <Globe className="w-8 h-8 text-orange-600" />,
      title: "Global Payments",
      description: "SEPA/SWIFT transfers, P2P payments, and cross-border transactions"
    },
    {
      icon: <Shield className="w-8 h-8 text-red-600" />,
      title: "Smart Contract Escrow",
      description: "Secure B2B transactions with milestone-based fund releases"
    },
    {
      icon: <Lock className="w-8 h-8 text-indigo-600" />,
      title: "Asset Tokenization",
      description: "Tokenize real-world assets like real estate, metals, and banking instruments"
    }
  ];

  const benefits = [
    "Bank-grade security with end-to-end encryption",
    "Regulatory compliance (KYC/AML, GDPR, PCI DSS)",
    "Multi-chain support (Ethereum, Polygon, BSC)",
    "24/7 customer support",
    "Real-time transaction monitoring",
    "Advanced risk management"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold text-blue-600">CryptoHybrid Bank</h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                to="/login"
                className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Create Account
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              The Future of
              <span className="text-blue-600"> Banking</span>
              <br />
              is Here
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Experience seamless integration of traditional banking and cryptocurrency. 
              Manage your fiat and crypto assets in one secure, compliant platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register"
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-colors flex items-center justify-center"
              >
                Get Started Free
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
              <Link
                to="/login"
                className="border-2 border-blue-600 text-blue-600 hover:bg-blue-50 px-8 py-4 rounded-lg text-lg font-semibold transition-colors"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Comprehensive Banking Solutions
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Everything you need for modern banking and cryptocurrency management
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="bg-gray-50 p-6 rounded-xl hover:shadow-lg transition-shadow">
                <div className="mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                Why Choose CryptoHybrid Bank?
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                We combine the best of traditional banking with cutting-edge blockchain technology 
                to provide you with a secure, compliant, and user-friendly financial platform.
              </p>
              <div className="space-y-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-gray-700">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-lg">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Star className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  Trusted by Thousands
                </h3>
                <p className="text-gray-600 mb-6">
                  Join our growing community of users who trust us with their financial needs.
                </p>
                <Link
                  to="/register"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors inline-block"
                >
                  Start Your Journey
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-blue-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Transform Your Banking Experience?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join CryptoHybrid Bank today and experience the future of banking.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-4 rounded-lg text-lg font-semibold transition-colors"
            >
              Create Account
            </Link>
            <Link
              to="/login"
              className="border-2 border-white text-white hover:bg-white hover:text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">CryptoHybrid Bank</h3>
              <p className="text-gray-400">
                The future of banking is here. Secure, compliant, and innovative.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
                Services
              </h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link to="/dashboard" className="hover:text-white transition-colors">Digital Wallets</Link></li>
                <li><Link to="/dashboard" className="hover:text-white transition-colors">Payment Cards</Link></li>
                <li><Link to="/dashboard" className="hover:text-white transition-colors">DeFi Integration</Link></li>
                <li><Link to="/dashboard" className="hover:text-white transition-colors">Asset Tokenization</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
                Support
              </h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link to="/dashboard" className="hover:text-white transition-colors">Help Center</Link></li>
                <li><Link to="/dashboard" className="hover:text-white transition-colors">Contact Us</Link></li>
                <li><Link to="/dashboard" className="hover:text-white transition-colors">Security</Link></li>
                <li><Link to="/dashboard" className="hover:text-white transition-colors">Compliance</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
                Legal
              </h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link to="/dashboard" className="hover:text-white transition-colors">Terms of Service</Link></li>
                <li><Link to="/dashboard" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link to="/dashboard" className="hover:text-white transition-colors">Cookie Policy</Link></li>
                <li><Link to="/dashboard" className="hover:text-white transition-colors">Regulatory</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 CryptoHybrid Bank. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
