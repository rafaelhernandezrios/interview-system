import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/axios';

const ApplicationStepper = ({ applicationStatus, onDownloadAcceptanceLetterSuccess, program }) => {
  const [payingFee, setPayingFee] = useState(false);
  const step1Completed = applicationStatus?.step1Completed || false;
  const step2Completed = applicationStatus?.step2Completed || false;
  const step3Completed = applicationStatus?.step3Completed || false;
  const step4Completed = applicationStatus?.step4Completed || false;
  const cvAnalyzed = applicationStatus?.cvAnalyzed || false;
  const acceptanceLetterGeneratedAt = applicationStatus?.acceptanceLetterGeneratedAt;
  const paymentProofStatus = applicationStatus?.paymentProofStatus || null;
  const registrationFeePaid = applicationStatus?.registrationFeePaid === true;

  const isMIRI = program === 'MIRI';
  const isEMFUTECH = program === 'EMFUTECH';

  // Future Innovators Japan (current round): the payment proof comes first and unlocks the form
  const fijPaymentProofRequired = applicationStatus?.fijPaymentProof?.required === true;
  const fijPaymentProofUploaded = !!applicationStatus?.fijPaymentProof?.uploadedAt;
  const fijPaymentSteps = fijPaymentProofRequired
    ? [
        {
          id: 'fij-payment',
          title: 'Payment Proof',
          description: 'Upload the receipt of your payment on the program website',
          route: null,
          completed: fijPaymentProofUploaded,
          available: true,
        },
      ]
    : [];

  const registrationFeeUsd = applicationStatus?.registrationFeeAmountUsd ?? 250;
  const stripeConfigured = applicationStatus?.stripeConfigured !== false;

  const invoiceStatus = applicationStatus?.invoiceStatus || null;
  const datesApproved = invoiceStatus === 'approved';

  const miriPostLetterSteps = isMIRI
    ? [
        {
          id: 'registration-fee',
          title: 'Registration Fee Payment',
          description: `Pay the program registration fee (USD ${registrationFeeUsd}) via Stripe. Once paid, you can select your participation dates.`,
          route: null,
          completed: registrationFeePaid,
          available: step4Completed,
        },
        {
          id: 'select-dates',
          title: 'Select Participation Dates',
          description: 'Choose your participation dates. Once an admin approves them, you can download your invoice.',
          route: null,
          completed: datesApproved,
          available: step4Completed && registrationFeePaid,
        },
        {
          id: 'program-payment',
          title: 'Program Payment',
          description: 'Pay the program tuition shown on your invoice, then upload the payment receipt (PDF) for verification',
          route: null,
          completed: paymentProofStatus === 'approved',
          available: step4Completed && registrationFeePaid && datesApproved,
        },
        {
          id: 'travel-details',
          title: 'Travel Details',
          description: 'Share your passport and flight information, and book Mirai’s accommodation service if you need a place to stay',
          route: null,
          optional: true,
          completed: !!applicationStatus?.travelDetails?.submittedAt,
          available: step4Completed && registrationFeePaid && datesApproved,
        },
      ]
    : [];

  const emfutechPostLetterSteps = isEMFUTECH
    ? [
        {
          id: 'register-payment',
          title: 'Register Payment',
          description: 'Upload your payment receipt (PDF) so an admin can verify it',
          route: null,
          completed: paymentProofStatus === 'approved',
          available: step4Completed,
        },
      ]
    : [];

  const steps = [
    ...fijPaymentSteps,
    {
      id: 1,
      title: 'Application Form',
      description: 'Complete your personal and academic information',
      route: '/application-form',
      completed: step1Completed,
      available: !fijPaymentProofRequired || fijPaymentProofUploaded,
    },
    {
      id: 'cv',
      title: 'Upload CV',
      description: 'Upload your CV and generate personalized interview questions',
      route: '/cv-upload',
      completed: cvAnalyzed,
      available: step1Completed,
    },
    {
      id: 2,
      title: 'AI Interview',
      description: 'Answer personalized interview questions',
      route: '/interview',
      completed: step2Completed,
      available: step1Completed && cvAnalyzed,
    },
    {
      id: 4,
      title: 'Decision Letter',
      description: 'Available after the committee evaluation',
      route: null,
      completed: step4Completed,
      available: !!acceptanceLetterGeneratedAt,
    },
    ...miriPostLetterSteps,
    ...emfutechPostLetterSteps,
  ];

  // Optional steps never block progress: they are not "active" and do not count toward the totals
  const requiredSteps = steps.filter((s) => !s.optional);
  const requiredCompletedCount = requiredSteps.filter((s) => s.completed).length;
  const activeStepId = requiredSteps.find((s) => !s.completed)?.id ?? requiredSteps[requiredSteps.length - 1]?.id;

  const handleDownloadAcceptanceLetter = async () => {
    try {
      const response = await api.get('/application/acceptance-letter', {
        responseType: 'blob',
      });
      const disposition = response.headers['content-disposition'];
      const fileNameMatch = disposition?.match(/filename="?([^"]+)"?/);
      const fileName = fileNameMatch?.[1] || 'Acceptance_Letter.pdf';
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      if (typeof onDownloadAcceptanceLetterSuccess === 'function') {
        onDownloadAcceptanceLetterSuccess();
      }
    } catch (error) {
      if (error.response?.data instanceof Blob) {
        error.response.data.text().then((text) => {
          try {
            const jsonError = JSON.parse(text);
            alert(jsonError.message || 'Error downloading letter.');
          } catch {
            alert('Error downloading acceptance letter.');
          }
        });
      } else {
        alert(error.response?.data?.message || 'Error downloading acceptance letter.');
      }
    }
  };

  const handlePayRegistrationFee = async () => {
    // Open the tab synchronously, before the request, so popup blockers treat it as a user action.
    const checkoutWindow = window.open('', '_blank');
    if (checkoutWindow) checkoutWindow.opener = null;
    setPayingFee(true);
    try {
      const response = await api.post('/application/registration-fee/checkout');
      const checkoutUrl = response.data?.url;
      if (!checkoutUrl) {
        throw new Error('Checkout URL not received');
      }
      if (checkoutWindow) {
        checkoutWindow.location.href = checkoutUrl;
        setPayingFee(false);
      } else {
        // Popup blocked: fall back to redirecting this tab.
        window.location.href = checkoutUrl;
      }
    } catch (error) {
      checkoutWindow?.close();
      alert(error.response?.data?.message || error.message || 'Error starting payment.');
      setPayingFee(false);
    }
  };

  const renderPostLetterStepAction = (step) => {
    if (!step.available) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
          Locked
        </span>
      );
    }

    if (step.id === 'registration-fee') {
      if (registrationFeePaid) {
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
            Paid
          </span>
        );
      }
      if (!stripeConfigured) {
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
            Unavailable
          </span>
        );
      }
      return (
        <button
          type="button"
          onClick={handlePayRegistrationFee}
          disabled={payingFee}
          className="inline-flex items-center justify-center bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-sm rounded-full px-8 py-3 shadow-lg shadow-indigo-500/40 hover:shadow-xl hover:scale-105 hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 disabled:opacity-50"
        >
          {payingFee ? 'Redirecting to Stripe...' : `Pay USD ${registrationFeeUsd}`}
          <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        </button>
      );
    }

    if (step.id === 'select-dates') {
      if (invoiceStatus === 'approved') {
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
            Dates approved
          </span>
        );
      }
      if (invoiceStatus === 'pending') {
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
            Under review
          </span>
        );
      }
      if (invoiceStatus === 'rejected') {
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
            Rejected — resubmit
          </span>
        );
      }
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
          Select below
        </span>
      );
    }

    if (step.id === 'travel-details') {
      return step.completed ? (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
          Shared
        </span>
      ) : (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
          Optional — fill below
        </span>
      );
    }

    if (step.id === 'program-payment' || step.id === 'register-payment') {
      if (paymentProofStatus === 'approved') {
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
            Payment verified
          </span>
        );
      }
      if (paymentProofStatus === 'pending') {
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
            Under review
          </span>
        );
      }
      if (paymentProofStatus === 'rejected') {
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
            Rejected — re-upload
          </span>
        );
      }
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
          Upload below
        </span>
      );
    }

    return null;
  };

  return (
    <div className="glass-card bg-white/60 backdrop-blur-xl border border-white/40 rounded-3xl p-6 sm:p-8 shadow-2xl">
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">
        Application Progress
      </h2>

      <div className="space-y-6">
        {steps.map((step, index) => {
          const isActive = activeStepId === step.id;
          const isCompleted = step.completed;
          const isAvailable = step.available;
          const isLast = index === steps.length - 1;
          const displayStepNumber = index + 1;
          const isPostLetterPaymentStep = [
            'registration-fee',
            'select-dates',
            'program-payment',
            'register-payment',
            'travel-details',
          ].includes(step.id);

          return (
            <div key={step.id} className="relative">
              {!isLast && (
                <div
                  className={`absolute left-6 top-12 w-0.5 h-full ${
                    isCompleted ? 'bg-blue-500' : 'bg-gray-300'
                  }`}
                  style={{ height: 'calc(100% + 1.5rem)' }}
                />
              )}

              <div className="flex items-start gap-4">
                <div className="relative z-10 flex-shrink-0">
                  {isCompleted ? (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center shadow-lg">
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  ) : isActive ? (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center shadow-lg animate-pulse">
                      <span className="text-white font-bold text-lg">{displayStepNumber}</span>
                    </div>
                  ) : (
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        isAvailable
                          ? 'bg-white/60 border-2 border-gray-300'
                          : 'bg-gray-200 border-2 border-gray-300 opacity-50'
                      }`}
                    >
                      <span className={`font-bold ${isAvailable ? 'text-gray-600' : 'text-gray-400'}`}>
                        {displayStepNumber}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex-1 pt-1">
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div className="flex-1">
                      <h3
                        className={`text-lg sm:text-xl font-bold mb-1 ${
                          isActive
                            ? 'text-blue-600'
                            : isCompleted
                            ? 'text-green-600'
                            : isAvailable
                            ? 'text-gray-700'
                            : 'text-gray-400'
                        }`}
                      >
                        {step.title}
                        {step.optional && (
                          <span className="ml-2 align-middle inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                            Optional
                          </span>
                        )}
                      </h3>
                      <p className={`text-sm ${isAvailable ? 'text-gray-600' : 'text-gray-400'}`}>
                        {step.description}
                      </p>
                    </div>

                    <div className="flex-shrink-0">
                      {isPostLetterPaymentStep ? (
                        renderPostLetterStepAction(step)
                      ) : step.id === 'fij-payment' ? (
                        isCompleted ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                            Uploaded
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                            Upload below
                          </span>
                        )
                      ) : step.id === 4 ? (
                        isAvailable ? (
                          <button
                            onClick={handleDownloadAcceptanceLetter}
                            className="inline-flex items-center justify-center bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm rounded-full px-8 py-3 shadow-lg shadow-emerald-500/40 hover:shadow-xl hover:scale-105 hover:from-emerald-700 hover:to-teal-700 transition-all duration-300"
                          >
                            Download PDF
                            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </button>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                            Locked
                          </span>
                        )
                      ) : isCompleted ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                          Completed
                        </span>
                      ) : isActive ? (
                        <Link to={step.route}>
                          <button className="inline-flex items-center justify-center bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-sm rounded-full px-8 py-3 shadow-lg shadow-blue-500/40 hover:shadow-xl hover:scale-105 hover:from-blue-700 hover:to-purple-700 transition-all duration-300">
                            Continue
                            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                          </button>
                        </Link>
                      ) : isAvailable ? (
                        <Link to={step.route}>
                          <button className="inline-flex items-center justify-center bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-sm rounded-full px-8 py-3 shadow-lg shadow-blue-500/40 hover:shadow-xl hover:scale-105 hover:from-blue-700 hover:to-purple-700 transition-all duration-300">
                            Start
                            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                          </button>
                        </Link>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                          Locked
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 pt-6 border-t border-white/40">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700">Overall Progress</span>
          <span className="text-sm font-bold text-gray-900">
            {requiredCompletedCount} / {requiredSteps.length} Steps
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500 rounded-full"
            style={{
              width: `${requiredSteps.length ? (requiredCompletedCount / requiredSteps.length) * 100 : 0}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default ApplicationStepper;
