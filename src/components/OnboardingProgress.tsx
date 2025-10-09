type Props = {
  currentStep: 1 | 2 | 3;
};

export function OnboardingProgress({ currentStep }: Props) {
  const steps = [
    { number: 1, label: 'Profil' },
    { number: 2, label: 'Dokumente' },
    { number: 3, label: 'Fertig' },
  ];

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, idx) => {
          const isActive = step.number === currentStep;
          const isComplete = step.number < currentStep;
          
          return (
            <div key={step.number} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${
                    isComplete
                      ? 'bg-emerald-600 text-white'
                      : isActive
                      ? 'border-2 border-emerald-600 bg-white text-emerald-600'
                      : 'border-2 border-gray-300 bg-white text-gray-400'
                  }`}
                >
                  {isComplete ? (
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    step.number
                  )}
                </div>
                <span
                  className={`mt-2 text-xs font-medium ${
                    isActive ? 'text-emerald-600' : isComplete ? 'text-emerald-600' : 'text-gray-500'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`mx-2 h-0.5 flex-1 ${
                    isComplete ? 'bg-emerald-600' : 'bg-gray-300'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
