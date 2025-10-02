import React from 'react';
import Logo from './Logo';

function PrivacyPolicy({ onBack }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-purple-100 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-lg p-8">
        <div className="mb-8">
          <Logo size="md" />
          <h1 className="text-2xl font-bold mt-4">Privacy Policy</h1>
          <p className="text-gray-600">Last updated: {new Date().toLocaleDateString()}</p>
        </div>

        <div className="prose prose-gray max-w-none">
          <h2 className="text-lg font-semibold mt-6 mb-3">Data We Collect</h2>
          <p className="mb-4">
            • Email address (for account creation)<br/>
            • List data you create<br/>
            • Google account info (if using Google Sign-In)
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-3">How We Use Your Data</h2>
          <p className="mb-4">
            • To provide the list collaboration service<br/>
            • To authenticate your account<br/>
            • To share lists with users you specify
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-3">Data Storage</h2>
          <p className="mb-4">
            Your data is stored securely in our database. Passwords are hashed and never stored in plain text.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-3">Data Sharing</h2>
          <p className="mb-4">
            We never sell or share your data with third parties. Lists are only shared with users you explicitly grant access to.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-3">Your Rights</h2>
          <p className="mb-4">
            You can delete your account and all associated data at any time. Contact support for data export requests.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-3">Contact</h2>
          <p className="mb-4">
            For privacy concerns, contact us at privacy@collaborlist.com
          </p>
        </div>

        <button
          onClick={onBack}
          className="mt-8 text-purple-600 hover:text-purple-700 font-medium"
        >
          ← Back to Login
        </button>
      </div>
    </div>
  );
}

export default PrivacyPolicy;