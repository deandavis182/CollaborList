import React from 'react';
import Logo from './Logo';

function TermsOfService({ onBack }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-purple-100 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-lg p-8">
        <div className="mb-8">
          <Logo size="md" />
          <h1 className="text-2xl font-bold mt-4">Terms of Service</h1>
          <p className="text-gray-600">Last updated: {new Date().toLocaleDateString()}</p>
        </div>

        <div className="prose prose-gray max-w-none">
          <h2 className="text-lg font-semibold mt-6 mb-3">1. Acceptance of Terms</h2>
          <p className="mb-4">
            By using CollaborList, you agree to these terms. If you don't agree, please don't use the service.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-3">2. Use of Service</h2>
          <p className="mb-4">
            • You must provide accurate information when creating an account<br/>
            • You're responsible for maintaining the security of your account<br/>
            • You must not use the service for illegal purposes<br/>
            • You must not attempt to disrupt or hack the service
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-3">3. Content</h2>
          <p className="mb-4">
            • You retain ownership of the lists you create<br/>
            • You grant us permission to store and display your content<br/>
            • You're responsible for the content you create and share<br/>
            • We may remove content that violates these terms
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-3">4. Service Availability</h2>
          <p className="mb-4">
            We strive for 99.9% uptime but don't guarantee uninterrupted service. We may perform maintenance or updates as needed.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-3">5. Liability</h2>
          <p className="mb-4">
            CollaborList is provided "as is" without warranties. We're not liable for any data loss or damages arising from use of the service.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-3">6. Termination</h2>
          <p className="mb-4">
            We may terminate accounts that violate these terms. You may delete your account at any time.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-3">7. Changes</h2>
          <p className="mb-4">
            We may update these terms occasionally. Continued use after changes constitutes acceptance.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-3">8. Contact</h2>
          <p className="mb-4">
            For questions about these terms, contact us at legal@collaborlist.com
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

export default TermsOfService;